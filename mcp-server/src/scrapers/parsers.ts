import type { OrderItem, Shipment } from "../types/index.js";
import {
  SUBTOTAL_PATTERN,
  SHIPPING_PATTERN,
  TAX_PATTERN,
  GRAND_TOTAL_PATTERN,
  STANDALONE_PRICE_PATTERN,
  DATE_PATTERN,
  extractFirst,
  toISODate,
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
          quantity: 1,
        });
      }
    }
  }

  return items;
}

/**
 * Parse items for digital orders (Kindle, Prime Video, etc.)
 * These don't have "Sold by:" pattern
 */
export function parseDigitalItems(
  pageText: string,
  orderTotal: string
): OrderItem[] {
  // Check for digital purchase patterns
  const digitalPatterns = [
    /Kindle/i,
    /Prime Video/i,
    /Amazon Music/i,
    /Audible/i,
    /Digital Order/i,
  ];

  const isDigital = digitalPatterns.some((p) => p.test(pageText));
  if (!isDigital) return [];

  // Try to find specific digital item name
  let itemName = "Digital Purchase";
  if (/Kindle/i.test(pageText)) itemName = "Kindle Purchase";
  else if (/Prime Video/i.test(pageText)) itemName = "Prime Video";
  else if (/Amazon Music/i.test(pageText)) itemName = "Amazon Music";
  else if (/Audible/i.test(pageText)) itemName = "Audible";

  return [
    {
      name: itemName,
      price: orderTotal,
      quantity: 1,
    },
  ];
}

/**
 * Check if the page text indicates items were found
 */
export function hasItems(pageText: string): boolean {
  return pageText.includes("Sold by:");
}

const SHIPMENT_HEADER_PATTERN = /^(Delivered|Arriving|Shipped)\b/i;

/**
 * Parse items grouped by shipment from order detail page text.
 *
 * Amazon's order detail page renders each shipment as a section prefixed by a
 * status line like "Delivered June 24, 2026" or "Arriving June 27, 2026".
 * Items within a section follow the same "Sold by:" pattern as parseItems().
 *
 * Returns [] when no shipment headers are found (single-shipment orders where
 * the header was stripped, digital orders, etc.) — callers should fall back to
 * the flat `items` list in that case.
 */
export function parseShipments(pageText: string): Shipment[] {
  const lines = pageText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l);

  const shipments: Shipment[] = [];
  let current: Shipment | null = null;
  const seenNames = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // New shipment section
    if (SHIPMENT_HEADER_PATTERN.test(line)) {
      const statusMatch = line.match(SHIPMENT_HEADER_PATTERN);
      const dateStr = extractFirst(line, DATE_PATTERN);
      current = {
        status: statusMatch ? statusMatch[1] : line,
        date: dateStr ? toISODate(dateStr) : "",
        items: [],
      };
      shipments.push(current);
      continue;
    }

    // Item within current section
    if (line.startsWith("Sold by:") && current) {
      let itemName = "";
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const prevLine = lines[j];
        if (
          prevLine.length > 30 &&
          !SHIPMENT_HEADER_PATTERN.test(prevLine) &&
          !prevLine.match(/^\$/) &&
          !seenNames.has(prevLine)
        ) {
          itemName = prevLine;
          break;
        }
      }

      let price = "";
      for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
        const nextLine = lines[j];
        const priceMatch = nextLine.match(STANDALONE_PRICE_PATTERN);
        if (priceMatch) {
          price = "$" + priceMatch[1];
          break;
        }
        if (nextLine === "Buy it again" || nextLine.startsWith("Sold by:")) {
          break;
        }
      }

      if (itemName && !seenNames.has(itemName)) {
        seenNames.add(itemName);
        current.items.push({
          name: itemName.substring(0, 200),
          price,
          quantity: 1,
        });
      }
    }
  }

  // Only return shipments if we found headers; otherwise the grouping is meaningless
  return shipments.length > 0 ? shipments : [];
}
