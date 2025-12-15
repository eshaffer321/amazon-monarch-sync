import type { Page } from "playwright";
import type { OrderSummary } from "../types/index.js";
import { AMAZON_URLS } from "../browser/config.js";
import { ORDER_ID_PATTERN, DATE_PATTERN, PRICE_PATTERN } from "../utils/patterns.js";

/**
 * Scrape order summaries from the order history page
 */
export async function scrapeOrderList(
  page: Page,
  year: string
): Promise<OrderSummary[]> {
  await page.goto(AMAZON_URLS.orderHistory(year), {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  const orderSummaries = await page.evaluate(
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

      return results;
    },
    {
      orderIdPattern: ORDER_ID_PATTERN.source,
      datePattern: DATE_PATTERN.source,
      pricePattern: PRICE_PATTERN.source,
    }
  );

  return orderSummaries;
}
