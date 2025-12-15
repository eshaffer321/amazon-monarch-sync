import type { OrderItem } from "../types/index.js";
import {
  SUBTOTAL_PATTERN,
  SHIPPING_PATTERN,
  TAX_PATTERN,
  GRAND_TOTAL_PATTERN,
  STANDALONE_PRICE_PATTERN,
  extractFirst,
} from "../utils/patterns.js";

/**
 * Parse order summary from page text
 */
export interface OrderSummaryParsed {
  subtotal: string;
  shipping: string;
  tax: string;
  total: string;
}

export function parseOrderSummary(pageText: string): OrderSummaryParsed {
  return {
    subtotal: extractFirst(pageText, SUBTOTAL_PATTERN) || "",
    shipping: extractFirst(pageText, SHIPPING_PATTERN) || "",
    tax: extractFirst(pageText, TAX_PATTERN) || "",
    total: extractFirst(pageText, GRAND_TOTAL_PATTERN) || "",
  };
}

/**
 * Parse items from page text using "Sold by:" pattern
 *
 * Amazon order details format:
 * [Delivery status]
 * [Item name - long product title]
 * Sold by: [seller]
 * $XX.XX (item price)
 * $XX.XX (may repeat)
 * Buy it again
 */
export function parseItems(pageText: string): OrderItem[] {
  const lines = pageText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);
  const items: OrderItem[] = [];
  const seenNames = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for "Sold by:" pattern - the item name is usually a few lines before
    if (line.startsWith("Sold by:")) {
      // Look backwards for the item name (skip short lines, delivery status, etc)
      let itemName = "";
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prevLine = lines[j];
        // Item names are typically long (> 30 chars) and don't match common patterns
        if (
          prevLine.length > 30 &&
          !prevLine.match(
            /^(Delivered|Arriving|Shipped|Your package|Return|Refund)/i
          ) &&
          !prevLine.match(/^\$/) &&
          !seenNames.has(prevLine)
        ) {
          itemName = prevLine;
          break;
        }
      }

      // Look forward for the price (should be right after "Sold by:")
      let price = "";
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const nextLine = lines[j];
        // First price we find after "Sold by:" is the item price
        const priceMatch = nextLine.match(STANDALONE_PRICE_PATTERN);
        if (priceMatch) {
          price = "$" + priceMatch[1];
          break;
        }
        // Stop if we hit "Buy it again" or another item
        if (nextLine === "Buy it again" || nextLine.startsWith("Sold by:")) {
          break;
        }
      }

      if (itemName && !seenNames.has(itemName)) {
        seenNames.add(itemName);
        items.push({
          name: itemName.substring(0, 200),
          price,
          quantity: "1",
        });
      }
    }
  }

  return items;
}

/**
 * Check if the page text indicates items were found
 */
export function hasItems(pageText: string): boolean {
  return pageText.includes("Sold by:");
}
