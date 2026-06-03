/**
 * Centralized regex patterns for Amazon scraping
 * When Amazon changes their format, update patterns here
 */

// Order ID format: 123-1234567-1234567
export const ORDER_ID_PATTERN = /(\d{3}-\d{7}-\d{7})/;

// Date format: Month Day, Year (e.g., "December 13, 2024")
export const DATE_PATTERN =
  /(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}/;

// Price format: $XX.XX or $X,XXX.XX
export const PRICE_PATTERN = /\$[\d,]+\.\d{2}/;

// Standalone price on its own line: $XX.XX
export const STANDALONE_PRICE_PATTERN = /^\$(\d+\.\d{2})$/;

// Order summary patterns
export const SUBTOTAL_PATTERN = /Item\(?s?\)?\s*Subtotal[:\s]*\n?\s*(\$[\d,.]+)/i;
export const SHIPPING_PATTERN = /Shipping\s*(?:&\s*Handling)?[:\s]*\n?\s*(\$[\d,.]+)/i;
export const TAX_PATTERN = /tax\s+(?:to be\s+)?collected[:\s]*\n?\s*(\$[\d,.]+)/i;
export const GRAND_TOTAL_PATTERN = /Grand\s*Total[:\s]*\n?\s*(\$[\d,.]+)/i;

/**
 * Extract first match from text using a pattern
 */
export function extractFirst(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern);
  return match ? match[1] || match[0] : null;
}

/**
 * Extract all matches from text using a pattern
 */
export function extractAll(text: string, pattern: RegExp): string[] {
  const matches: string[] = [];
  const globalPattern = new RegExp(pattern.source, "g");
  let match;
  while ((match = globalPattern.exec(text)) !== null) {
    matches.push(match[1] || match[0]);
  }
  return matches;
}

// Card last 4 digits pattern: ****1234 or "ending in 1234"
export const LAST4_PATTERN = /\*{4}(\d{4})|ending in (\d{4})/i;

/**
 * Extract last 4 digits of card from description
 */
export function extractLast4(description: string): string {
  const match = description.match(LAST4_PATTERN);
  if (match) {
    return match[1] || match[2] || "";
  }
  return "";
}

const MONTH_MAP: Record<string, string> = {
  January: "01",
  February: "02",
  March: "03",
  April: "04",
  May: "05",
  June: "06",
  July: "07",
  August: "08",
  September: "09",
  October: "10",
  November: "11",
  December: "12",
};

/**
 * Convert "December 13, 2024" to "2024-12-13"
 */
export function toISODate(dateStr: string): string {
  const match = dateStr.match(
    /(\w+)\s+(\d{1,2}),\s+(\d{4})/
  );
  if (!match) return dateStr;

  const [, month, day, year] = match;
  const monthNum = MONTH_MAP[month];
  if (!monthNum) return dateStr;

  return `${year}-${monthNum}-${day.padStart(2, "0")}`;
}

/**
 * Parse ISO date string to Date object
 */
export function parseISODate(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00");
}

/**
 * Check if a date is within a range
 */
export function isDateInRange(
  date: string,
  since?: string,
  until?: string
): boolean {
  const d = parseISODate(date);
  if (since && d < parseISODate(since)) return false;
  if (until && d > parseISODate(until)) return false;
  return true;
}
