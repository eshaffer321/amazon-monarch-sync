import type { Page } from "playwright";
import type { Transaction } from "../types/index.js";
import { DATE_PATTERN, PRICE_PATTERN } from "../utils/patterns.js";

/**
 * Scrape transaction/payment details from the transactions page
 */
export async function scrapeTransactions(
  page: Page,
  transactionsUrl: string
): Promise<Transaction[]> {
  try {
    await page.goto(transactionsUrl, {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    await page.waitForTimeout(2000);

    const transactions = await page.evaluate(
      ({ datePattern, pricePattern }) => {
        const results: Array<{
          date: string;
          amount: string;
          type: string;
          description: string;
        }> = [];

        const txnRows = document.querySelectorAll(
          '.a-box, [class*="transaction"], tr'
        );

        txnRows.forEach((row) => {
          const text = row.textContent || "";
          const dateMatch = text.match(new RegExp(datePattern));
          const amountMatch = text.match(new RegExp(pricePattern));
          const typeMatch = text.match(/(charge|refund|payment|credit)/i);

          if (dateMatch && amountMatch) {
            results.push({
              date: dateMatch[0],
              amount: amountMatch[0],
              type: typeMatch ? typeMatch[1].toLowerCase() : "charge",
              description: text.substring(0, 200).trim(),
            });
          }
        });

        return results;
      },
      {
        datePattern: DATE_PATTERN.source,
        pricePattern: PRICE_PATTERN.source,
      }
    );

    return transactions as Transaction[];
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
}
