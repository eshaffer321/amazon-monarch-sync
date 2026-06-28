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

    return { pageText, transactionUrls };
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
  order.items = parseItems(details.pageText);

  // If no items found, try digital order parsing
  if (order.items.length === 0) {
    order.items = parseDigitalItems(details.pageText, order.total);
  }

  // Parse items grouped by shipment section
  order.shipments = parseShipments(details.pageText);

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
