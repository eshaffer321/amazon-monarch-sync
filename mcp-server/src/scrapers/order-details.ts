import type { Page } from "playwright";
import type { Order, OrderSummary } from "../types/index.js";
import { parseItems, parseOrderSummary } from "./parsers.js";
import { scrapeTransactions } from "./transactions.js";

/**
 * Scrape detailed order information from an order details page
 */
export async function scrapeOrderDetails(
  page: Page,
  summary: OrderSummary
): Promise<Order> {
  const order: Order = {
    orderId: summary.orderId,
    orderDate: summary.orderDate,
    total: summary.total,
    subtotal: "",
    tax: "",
    shipping: "",
    items: [],
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

    // Find transaction link
    let transactionsUrl = "";
    const allLinks = document.querySelectorAll("a");
    for (const link of allLinks) {
      const text = link.textContent?.toLowerCase() || "";
      const href = link.href || "";
      if (text.includes("transaction") || href.includes("transaction")) {
        transactionsUrl = href;
        break;
      }
    }

    return { pageText, transactionsUrl };
  });

  // Parse order summary
  const summaryParsed = parseOrderSummary(details.pageText);
  order.subtotal = summaryParsed.subtotal;
  order.tax = summaryParsed.tax;
  order.shipping = summaryParsed.shipping;
  if (summaryParsed.total) {
    order.total = summaryParsed.total;
  }

  // Parse items
  order.items = parseItems(details.pageText);

  // Get transaction details if available
  if (details.transactionsUrl) {
    order.transactionsUrl = details.transactionsUrl;
    order.transactions = await scrapeTransactions(page, details.transactionsUrl);
  }

  return order;
}
