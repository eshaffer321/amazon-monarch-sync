import type { Page } from "playwright";
import type { OrderSummary } from "../types/index.js";
import { AMAZON_URLS } from "../browser/config.js";
import {
  ORDER_ID_PATTERN,
  DATE_PATTERN,
  PRICE_PATTERN,
  isDateInRange,
  parseISODate,
  toISODate,
} from "../utils/patterns.js";

const MAX_ORDER_HISTORY_PAGES = 50;

interface OrderListPage {
  orders: OrderSummary[];
  nextUrl: string;
}

export interface ScrapeOrderListOptions {
  since?: string;
  until?: string;
}

/**
 * Scrape order summaries from the order history page
 */
export async function scrapeOrderList(
  page: Page,
  year: string,
  options: ScrapeOrderListOptions = {}
): Promise<OrderSummary[]> {
  const orderSummaries: OrderSummary[] = [];
  const seenOrderIDs = new Set<string>();
  const visitedUrls = new Set<string>();
  let nextUrl = AMAZON_URLS.orderHistory(year);

  for (
    let pageNumber = 0;
    nextUrl && pageNumber < MAX_ORDER_HISTORY_PAGES;
    pageNumber++
  ) {
    if (visitedUrls.has(nextUrl)) {
      break;
    }
    visitedUrls.add(nextUrl);

    // Add a delay before each page (longer for later pages to avoid rate limiting)
    if (pageNumber > 0) {
      await page.waitForTimeout(2000 + pageNumber * 1000);
    }
    await page.goto(nextUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const currentPage = await scrapeCurrentOrderListPage(page);
    for (const order of currentPage.orders) {
      if (seenOrderIDs.has(order.orderId)) {
        continue;
      }
      if (!isOrderInRange(order, options)) {
        continue;
      }
      seenOrderIDs.add(order.orderId);
      orderSummaries.push(order);
    }

    if (hasReachedBeforeSince(currentPage.orders, options.since)) {
      break;
    }
    nextUrl = currentPage.nextUrl;
  }

  return orderSummaries;
}

function isOrderInRange(
  order: OrderSummary,
  options: ScrapeOrderListOptions
): boolean {
  return isDateInRange(toISODate(order.orderDate), options.since, options.until);
}

function hasReachedBeforeSince(orders: OrderSummary[], since?: string): boolean {
  if (!since) {
    return false;
  }

  const sinceDate = parseISODate(since);
  for (const order of orders) {
    const orderDate = parseISODate(toISODate(order.orderDate));
    if (!Number.isNaN(orderDate.getTime()) && orderDate < sinceDate) {
      return true;
    }
  }

  return false;
}

async function scrapeCurrentOrderListPage(page: Page): Promise<OrderListPage> {
  return page.evaluate(
    ({ orderIdPattern, datePattern, pricePattern }) => {
      const results: Array<{
        orderId: string;
        orderDate: string;
        total: string;
        detailsUrl: string;
      }> = [];

      const orderCards = document.querySelectorAll(
        '.order-card, .js-order-card, [class*="order-card"]'
      );

      orderCards.forEach((card) => {
        const orderIdMatch = card.innerHTML.match(new RegExp(orderIdPattern));
        const orderId = orderIdMatch ? orderIdMatch[1] : "";

        let orderDate = "";
        const dateMatch = card.textContent?.match(new RegExp(datePattern));
        if (dateMatch) orderDate = dateMatch[0];

        // Get total from order card
        let total = "";
        const totalMatch =
          card.textContent?.match(/ORDER TOTAL[^$]*(\$[\d,.]+)/i) ||
          card.textContent?.match(/Total[^$]*(\$[\d,.]+)/);
        if (totalMatch) total = totalMatch[1];

        // Get order details link
        let detailsUrl = "";
        const allLinks = card.querySelectorAll("a[href]");
        for (const link of allLinks) {
          const href = (link as HTMLAnchorElement).href || "";
          if (
            href.includes("order-details") ||
            href.includes("orderID=" + orderId)
          ) {
            detailsUrl = href;
            break;
          }
        }

        // Fallback: construct URL directly
        if (!detailsUrl && orderId) {
          detailsUrl = `https://www.amazon.com/gp/your-account/order-details?orderID=${orderId}`;
        }

        if (orderId) {
          results.push({ orderId, orderDate, total, detailsUrl });
        }
      });

      let nextUrl = "";
      const paginationLinks = document.querySelectorAll("a[href]");
      for (const link of paginationLinks) {
        const anchor = link as HTMLAnchorElement;
        const href = anchor.href || "";
        const text = anchor.textContent?.trim().toLowerCase() || "";
        const ariaLabel = anchor.getAttribute("aria-label")?.toLowerCase() || "";
        const parentClass =
          typeof anchor.parentElement?.className === "string"
            ? anchor.parentElement.className.toLowerCase()
            : "";
        const disabled =
          anchor.getAttribute("aria-disabled") === "true" ||
          anchor.closest(".a-disabled, [aria-disabled='true']");

        if (disabled || !href) {
          continue;
        }
        if (
          text === "next" ||
          ariaLabel.includes("next") ||
          parentClass.includes("a-last")
        ) {
          nextUrl = href;
          break;
        }
      }

      return { orders: results, nextUrl };
    },
    {
      orderIdPattern: ORDER_ID_PATTERN.source,
      datePattern: DATE_PATTERN.source,
      pricePattern: PRICE_PATTERN.source,
    }
  );
}
