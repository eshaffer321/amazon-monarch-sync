import type { Page } from "playwright";
import type { Order, OrderSummary } from "../types/index.js";
import { parseItems, parseOrderSummary, parseDigitalItems, parseShipments } from "./parsers.js";
import { scrapeTransactions } from "./transactions.js";
import { toISODate } from "../utils/patterns.js";

/**
 * Scrape detailed order information from an order details page
 */
export async function scrapeOrderDetails(
  page: Page,
  summary: OrderSummary
): Promise<Order> {
  const order: Order = {
    orderId: summary.orderId,
    orderDate: toISODate(summary.orderDate),
    total: summary.total,
    subtotal: "",
    tax: "",
    shipping: "",
    items: [],
    shipments: [],
    transactions: [],
  };

  if (!summary.detailsUrl) {
    return order;
  }

  // Navigate to order details page
  await page.goto(summary.detailsUrl, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  // Extract page text and parse
  const details = await page.evaluate(() => {
    const pageText = document.body.innerText;

    const standalonePricePattern = /^\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?$/;
    const shipmentHeaderPattern = /^(Delivered|Arriving|Shipped)\b/i;

    function normalizeText(text: string | null | undefined): string {
      return (text || "").replace(/\s+/g, " ").trim();
    }

    function extractItemsFromContainer(container: Element) {
      const itemRoot = container;
      const titleLinks = Array.from(
        itemRoot.querySelectorAll<HTMLAnchorElement>("a[href*='/dp/']")
      ).filter(
        (link) =>
          normalizeText(link.textContent).length > 30 &&
          link.closest("[data-component='itemTitle']")
      );

      const lines = (itemRoot as HTMLElement).innerText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      let searchStart = 0;
      return titleLinks.map((titleLink) => {
        const name = normalizeText(titleLink.textContent);
        const titleIndex = lines.findIndex(
          (line, index) => index >= searchStart && normalizeText(line) === name
        );
        const priceIndex = lines.findIndex(
          (line, index) =>
            index > (titleIndex >= 0 ? titleIndex : searchStart) &&
            standalonePricePattern.test(line)
        );
        if (priceIndex >= 0) {
          searchStart = priceIndex + 1;
        }

        return {
          name: name.substring(0, 200),
          price: priceIndex >= 0 ? lines[priceIndex] : "",
          quantity: 1,
        };
      });
    }

    const items = Array.from(
      document.querySelectorAll("[data-component='purchasedItems']")
    )
      .flatMap(extractItemsFromContainer);

    const shipments = Array.from(
      document.querySelectorAll("[data-component='shipmentsLeftGrid']")
    )
      .map((shipmentEl) => {
        const lines = (shipmentEl as HTMLElement).innerText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const header = lines.find((line) => shipmentHeaderPattern.test(line));
        if (!header) {
          return null;
        }
        const statusMatch = header.match(shipmentHeaderPattern);
        const shipmentItems = Array.from(
          shipmentEl.querySelectorAll("[data-component='purchasedItems']")
        )
          .flatMap(extractItemsFromContainer);

        return {
          status: statusMatch ? statusMatch[1] : header,
          date: "",
          items: shipmentItems,
        };
      })
      .filter(
        (shipment): shipment is NonNullable<typeof shipment> =>
          shipment !== null && shipment.items.length > 0
      );

    // Collect ALL transaction links — multi-delivery orders have one per shipment
    const transactionUrls: string[] = [];
    const seen = new Set<string>();
    const allLinks = document.querySelectorAll("a");
    for (const link of allLinks) {
      const text = link.textContent?.toLowerCase() || "";
      const href = link.href || "";
      if ((text.includes("transaction") || href.includes("transaction")) && href && !seen.has(href)) {
        seen.add(href);
        transactionUrls.push(href);
      }
    }

    return { pageText, transactionUrls, items, shipments };
  });

  // Parse order summary
  const summaryParsed = parseOrderSummary(details.pageText);
  order.subtotal = summaryParsed.subtotal;
  order.tax = summaryParsed.tax;
  order.shipping = summaryParsed.shipping;
  if (summaryParsed.total) {
    order.total = summaryParsed.total;
  }

  // Parse items - try regular items first, then digital
  order.items = details.items.length > 0 ? details.items : parseItems(details.pageText);

  // If no items found, try digital order parsing
  if (order.items.length === 0) {
    order.items = parseDigitalItems(details.pageText, order.total);
  }

  // Parse items grouped by shipment section
  order.shipments =
    details.shipments.length > 0 ? details.shipments : parseShipments(details.pageText);

  // Get transaction details — scrape all links and merge, deduplicating by amount+date+last4
  if (details.transactionUrls.length > 0) {
    order.transactionsUrl = details.transactionUrls[0];
    const seen = new Set<string>();
    for (const url of details.transactionUrls) {
      const txns = await scrapeTransactions(page, url);
      for (const txn of txns) {
        const key = `${txn.date}|${txn.amount}|${txn.last4}`;
        if (!seen.has(key)) {
          seen.add(key);
          order.transactions.push(txn);
        }
      }
    }
  }

  return order;
}
