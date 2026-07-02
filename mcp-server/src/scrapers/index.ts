import type { Page } from "playwright";
import type { Order, ScrapeResponse, FetchOrdersResult } from "../types/index.js";
import { getBrowserClient, getCurrentProfile } from "../browser/client.js";
import { AMAZON_URLS } from "../browser/config.js";
import { AmazonScraperError, LoginRequiredError, ScrapingError } from "../utils/errors.js";
import { scrapeOrderList, type ScrapeOrderListOptions } from "./orders.js";
import { scrapeOrderDetails } from "./order-details.js";

export { parseItems, parseOrderSummary } from "./parsers.js";
export { scrapeOrderList } from "./orders.js";
export { scrapeOrderDetails } from "./order-details.js";
export { scrapeTransactions } from "./transactions.js";

/**
 * Main function to fetch all orders for a given year
 */
export async function fetchAmazonOrders(
  year: string,
  options: ScrapeOrderListOptions = {}
): Promise<ScrapeResponse<FetchOrdersResult>> {
  process.stderr.write(`[amazon-scraper] Starting order fetch for ${year}...\n`);
  const startTime = Date.now();
  const browser = getBrowserClient();
  const page = await browser.newPageAndNavigate(AMAZON_URLS.orderHistory(year));

  try {
    const log = (msg: string) => process.stderr.write(`[amazon-scraper] ${msg}\n`);

    log("Navigated to Amazon order history");

    // Check if login is required
    if (await browser.isLoginRequired(page)) {
      const config = browser.getConfig();
      if (config.headless) {
        await page.close();
        const profile = getCurrentProfile();
        log(`✗ Session expired — re-authenticate with: amazon-scraper --login${profile ? ` --profile ${profile}` : ""}`);
        return {
          success: false,
          error: `Login required. Run: amazon-scraper --login${profile ? ` --profile ${profile}` : ""}`,
          needsLogin: true,
        };
      }
      log("Login required - waiting for user authentication...");
      const loggedIn = await browser.waitForLogin(page);
      if (!loggedIn) {
        await page.close();
        log("✗ Login timed out");
        return {
          success: false,
          error: new LoginRequiredError().message,
          needsLogin: true,
        };
      }
      log("✓ Login successful, continuing...");
      await browser.navigateTo(page, AMAZON_URLS.orderHistory(year));
    } else {
      log("Already authenticated");
    }

    log("Fetching order list...");
    const orderSummaries = await scrapeOrderList(page, year, options);
    log(`Found ${orderSummaries.length} orders`);

    const orders: Order[] = [];
    const errors: string[] = [];

    for (let i = 0; i < orderSummaries.length; i++) {
      const summary = orderSummaries[i];
      const progress = `[${i + 1}/${orderSummaries.length}]`;
      try {
        log(`${progress} Fetching details for order ${summary.orderId}...`);
        const orderDetails = await scrapeOrderDetails(page, summary);
        orders.push(orderDetails);
        log(`${progress} ✓ Extracted ${orderDetails.items.length} items`);
      } catch (e) {
        if (shouldAbortOrderFetch(e)) {
          throw e;
        }
        const errorMsg = `Order ${summary.orderId}: ${e instanceof Error ? e.message : String(e)}`;
        errors.push(errorMsg);
        log(`${progress} ✗ Failed: ${errorMsg}`);
        orders.push({
          orderId: summary.orderId,
          orderDate: summary.orderDate,
          total: summary.total,
          subtotal: "",
          tax: "",
          shipping: "",
          items: [],
          shipments: [],
          transactions: [],
        });
      }
    }

    await page.close();
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`✓ Complete: ${orders.length} orders in ${duration}s`);

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

export function shouldAbortOrderFetch(error: unknown): boolean {
  return error instanceof AmazonScraperError && error.code === "SUSPICIOUS_ITEM_NAME";
}

/**
 * Interactive login - opens browser to Amazon and waits for user to log in
 * Returns true if login succeeded, false if timed out
 */
export async function interactiveLogin(timeoutMs: number = 300000): Promise<boolean> {
  const browser = getBrowserClient();
  const page = await browser.newPageAndNavigate(AMAZON_URLS.orderHistory(new Date().getFullYear().toString()));

  try {

    // Check if already logged in
    if (!(await browser.isLoginRequired(page))) {
      console.log("Already logged in!");
      await page.close();
      return true;
    }

    // Wait for login with extended timeout
    console.log("Waiting for login...");
    const loggedIn = await browser.waitForLogin(page, timeoutMs);
    await page.close();
    return loggedIn;
  } catch (e) {
    await page.close();
    throw e;
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
