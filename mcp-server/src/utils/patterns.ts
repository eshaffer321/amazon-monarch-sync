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
