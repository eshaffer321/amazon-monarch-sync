import type { Page } from "playwright";
import type { Transaction } from "../types/index.js";
import {
  DATE_PATTERN,
  LAST4_PATTERN,
  toISODate,
} from "../utils/patterns.js";

// Matches a single card charge entry: "****1211-$63.99" or "ending in 1211 $63.99"
// Amazon places one entry per shipment charge on the transactions page.
const CARD_CHARGE_PATTERN = /\*{4}(\d{4})[^\$]*(\$[\d,]+\.\d{2})/g;

/**
 * Scrape transaction/payment details from the transactions page.
 *
 * Amazon's transaction page lists every charge for an order, one entry per
 * shipment. Each entry has the format "****1234-$XX.XX" or similar. A naive
 * text.match() only finds the first price — this function instead scans the
 * full page text for every card-charge entry and emits one Transaction per hit.
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

    const pageText = await page.evaluate(() => document.body.innerText);

    return parseTransactionsFromText(pageText);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
}

/**
 * Parse all card charges out of the transactions page text.
 * Exported for unit testing.
 */
export function parseTransactionsFromText(pageText: string): Transaction[] {
  const results: Transaction[] = [];
  const seen = new Set<string>();

  // Walk through every card-charge entry on the page.
  // For each "****1234-$XX.XX" hit, look backwards in the text for the most
  // recent date line, and forwards for a refund/credit keyword.
  const cardMatches = [...pageText.matchAll(CARD_CHARGE_PATTERN)];

  for (const match of cardMatches) {
    const last4 = match[1];
    const amountStr = match[2];
    const matchIndex = match.index ?? 0;

    // Find the most recent date before this charge entry
    const textBefore = pageText.slice(0, matchIndex);
    const allDatesBefore = [...textBefore.matchAll(new RegExp(DATE_PATTERN.source, "g"))];
    const dateStr = allDatesBefore.length > 0
      ? allDatesBefore[allDatesBefore.length - 1][0]
      : "";

    // Detect refund/credit by scanning a window around the match
    const window = pageText.slice(Math.max(0, matchIndex - 50), matchIndex + 100);
    const typeMatch = window.match(/(refund|credit)/i);
    const type: Transaction["type"] = typeMatch ? "refund" : "charge";

    const key = `${dateStr}|${amountStr}|${last4}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      date: dateStr ? toISODate(dateStr) : "",
      amount: amountStr,
      type,
      last4,
      description: window.trim(),
    });
  }

  // Fallback: if the card-charge pattern found nothing (unusual page layout),
  // try the original broad row-based approach
  if (results.length === 0) {
    return fallbackParseTransactions(pageText);
  }

  return results;
}

function fallbackParseTransactions(pageText: string): Transaction[] {
  const results: Transaction[] = [];
  const datePattern = new RegExp(DATE_PATTERN.source, "g");
  const pricePattern = /\$[\d,]+\.\d{2}/g;
  const last4Pattern = new RegExp(LAST4_PATTERN.source, "gi");

  const dates = [...pageText.matchAll(datePattern)].map((m) => m[0]);
  const amounts = [...pageText.matchAll(pricePattern)].map((m) => m[0]);
  const last4s = [...pageText.matchAll(last4Pattern)].map(
    (m) => m[1] || m[2] || ""
  );

  if (dates.length > 0 && amounts.length > 0) {
    results.push({
      date: toISODate(dates[0]),
      amount: amounts[0],
      type: "charge",
      last4: last4s[0] || "",
      description: pageText.substring(0, 200).trim(),
    });
  }

  return results;
}
