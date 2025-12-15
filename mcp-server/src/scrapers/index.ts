import type { Page } from "playwright";
import type { Order, ScrapeResponse, FetchOrdersResult } from "../types/index.js";
import { getBrowserClient } from "../browser/client.js";
import { AMAZON_URLS } from "../browser/config.js";
import { LoginRequiredError, ScrapingError } from "../utils/errors.js";
import { scrapeOrderList } from "./orders.js";
import { scrapeOrderDetails } from "./order-details.js";

export { parseItems, parseOrderSummary } from "./parsers.js";
export { scrapeOrderList } from "./orders.js";
export { scrapeOrderDetails } from "./order-details.js";
export { scrapeTransactions } from "./transactions.js";

/**
 * Main function to fetch all orders for a given year
 */
export async function fetchAmazonOrders(
  year: string
): Promise<ScrapeResponse<FetchOrdersResult>> {
  const browser = getBrowserClient();
  const page = await browser.newPage();

  try {
    // Navigate to order history
    await browser.navigateTo(page, AMAZON_URLS.orderHistory(year));

    // Check if login is required
    if (await browser.isLoginRequired(page)) {
      await page.close();
      return {
        success: false,
        error: new LoginRequiredError().message,
        needsLogin: true,
      };
    }

    // Get order summaries from list page
    const orderSummaries = await scrapeOrderList(page, year);

    // Fetch details for each order
    const orders: Order[] = [];
    const errors: string[] = [];

    for (const summary of orderSummaries) {
      try {
        const orderDetails = await scrapeOrderDetails(page, summary);
        orders.push(orderDetails);
      } catch (e) {
        const errorMsg = `Order ${summary.orderId}: ${e instanceof Error ? e.message : String(e)}`;
        errors.push(errorMsg);
        // Still add basic order info even if details fail
        orders.push({
          orderId: summary.orderId,
          orderDate: summary.orderDate,
          total: summary.total,
          subtotal: "",
          tax: "",
          shipping: "",
          items: [],
          transactions: [],
        });
      }
    }

    await page.close();

    return {
      success: true,
      data: {
        orders,
        errors: errors.length > 0 ? errors : undefined,
      },
    };
  } catch (e) {
    await page.close();
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Debug function to get raw page text
 */
export async function getPageText(orderId: string): Promise<string> {
  const browser = getBrowserClient();
  const page = await browser.newPage();

  try {
    await browser.navigateTo(page, AMAZON_URLS.orderDetails(orderId));
    const pageText = await page.evaluate(() => document.body.innerText);
    await page.close();
    return pageText;
  } catch (e) {
    await page.close();
    throw e;
  }
}

/**
 * Debug function to get raw page HTML
 */
export async function getPageHtml(
  year?: string,
  orderId?: string
): Promise<string> {
  const browser = getBrowserClient();
  const page = await browser.newPage();

  try {
    const url = orderId
      ? AMAZON_URLS.orderDetails(orderId)
      : AMAZON_URLS.orderHistory(year || new Date().getFullYear().toString());

    await browser.navigateTo(page, url);
    const html = await page.content();
    await page.close();
    return html;
  } catch (e) {
    await page.close();
    throw e;
  }
}
