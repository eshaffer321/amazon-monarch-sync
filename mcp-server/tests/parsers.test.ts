import { describe, it, expect } from "vitest";
import { parseItems, parseOrderSummary, parseDigitalItems, parseShipments } from "../src/scrapers/parsers.js";
import { toISODate, extractLast4, isDateInRange } from "../src/utils/patterns.js";

describe("parseOrderSummary", () => {
  it("should extract order summary from page text", () => {
    const pageText = `
Order Summary
Item(s) Subtotal:
$42.37
Shipping & Handling:
$0.00
Total before tax:
$42.37
Estimated tax to be collected:
$2.54
Grand Total:
$44.91
    `;

    const result = parseOrderSummary(pageText);

    expect(result.subtotal).toBe("$42.37");
    expect(result.shipping).toBe("$0.00");
    expect(result.tax).toBe("$2.54");
    expect(result.total).toBe("$44.91");
  });

  it("should handle missing values", () => {
    const pageText = "Some random text without order info";

    const result = parseOrderSummary(pageText);

    expect(result.subtotal).toBe("");
    expect(result.shipping).toBe("");
    expect(result.tax).toBe("");
    expect(result.total).toBe("");
  });
});

describe("parseItems", () => {
  it("should extract items from page text with Sold by pattern", () => {
    const pageText = `
Delivered November 24
Your package was left near the front door or porch.
Connoisseurs Premium Edition Silver Jewelry Cleaner Solution for Sterling Silver - 9.6 fl oz - Cleans and Removes Tarnish in Seconds
Sold by: Connoisseurs Products
$9.99
$9.99
Buy it again
    `;

    const items = parseItems(pageText);

    expect(items).toHaveLength(1);
    expect(items[0].name).toContain("Connoisseurs Premium Edition");
    expect(items[0].price).toBe("$9.99");
    expect(items[0].quantity).toBe(1);
  });

  it("should extract multiple items", () => {
    const pageText = `
Delivered November 24
Loritta 3-Pieces Winter Hat Neck Warmer Touchscreen Gloves Set Knit Thick Scarf Beanie Hat Scarves Set Gifts for Women, Beige
Sold by: Loritta-US
$14.99
$14.99
Buy it again

ORALER Fuzzy Socks Gifts for Women - Cozy Fluffy Winter Soft Warm Plush Slipper Socks - Christmas Stocking Stuffers for Women
Sold by: ORALER Store
$6.99
$6.99
Buy it again

EACHY Travel Makeup Bag, Large Capacity Cosmetic Bags for Women, Waterproof Portable Pouch Open Flat Toiletry Bag Pattern Make up Bag (F-Beige)
Sold by: EACHY Official
$20.39
$20.39
Buy it again
    `;

    const items = parseItems(pageText);

    expect(items).toHaveLength(3);
    expect(items[0].name).toContain("Loritta");
    expect(items[0].price).toBe("$14.99");
    expect(items[1].name).toContain("ORALER");
    expect(items[1].price).toBe("$6.99");
    expect(items[2].name).toContain("EACHY");
    expect(items[2].price).toBe("$20.39");
  });

  it("should return empty array when no Sold by pattern found", () => {
    const pageText = "Some random text without items";

    const items = parseItems(pageText);

    expect(items).toHaveLength(0);
  });

  it("should skip short item names", () => {
    const pageText = `
Short
Sold by: Someone
$5.00
    `;

    const items = parseItems(pageText);

    expect(items).toHaveLength(0);
  });

  it("should throw when refund status text is where an item name should be", () => {
    const pageText = `
Delivered June 29
There's no need to return your item. Your refund has been issued.
Sold by: Amazon.com
$9.99
$9.99
Buy it again
    `;

    expect(() => parseItems(pageText)).toThrow("status/refund text");
  });
});

describe("parseShipments", () => {
  it("should throw when delivery status text is where a shipment item name should be", () => {
    const pageText = `
Delivered
Your package was left near the front door or porch.
Sold by: Amazon.com
$9.99
$9.99
Buy it again
    `;

    expect(() => parseShipments(pageText)).toThrow("status/refund text");
  });
});

describe("parseDigitalItems", () => {
  it("should parse Kindle purchases", () => {
    const pageText = `
Digital Order: Kindle
Your Kindle purchase
Order Total: $9.99
    `;

    const items = parseDigitalItems(pageText, "$9.99");

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Kindle Purchase");
    expect(items[0].price).toBe("$9.99");
    expect(items[0].quantity).toBe(1);
  });

  it("should parse Prime Video purchases", () => {
    const pageText = `
Prime Video rental
Your video purchase
    `;

    const items = parseDigitalItems(pageText, "$3.99");

    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Prime Video");
    expect(items[0].price).toBe("$3.99");
  });

  it("should return empty for non-digital orders", () => {
    const pageText = `
Physical product order
Shipped via UPS
    `;

    const items = parseDigitalItems(pageText, "$19.99");

    expect(items).toHaveLength(0);
  });
});

describe("toISODate", () => {
  it("should convert Amazon date format to ISO", () => {
    expect(toISODate("November 24, 2024")).toBe("2024-11-24");
    expect(toISODate("January 5, 2024")).toBe("2024-01-05");
    expect(toISODate("December 31, 2023")).toBe("2023-12-31");
  });

  it("should return original string for invalid format", () => {
    expect(toISODate("invalid date")).toBe("invalid date");
    expect(toISODate("2024-01-01")).toBe("2024-01-01");
  });
});

describe("extractLast4", () => {
  it("should extract last 4 digits with asterisks", () => {
    expect(extractLast4("****1234")).toBe("1234");
    expect(extractLast4("Visa ****5678")).toBe("5678");
  });

  it("should extract last 4 digits with 'ending in'", () => {
    expect(extractLast4("Visa ending in 1234")).toBe("1234");
    expect(extractLast4("Card ending in 9999")).toBe("9999");
  });

  it("should return empty string when no match", () => {
    expect(extractLast4("Some random text")).toBe("");
    expect(extractLast4("")).toBe("");
  });
});

describe("isDateInRange", () => {
  it("should return true when date is in range", () => {
    expect(isDateInRange("2024-06-15", "2024-01-01", "2024-12-31")).toBe(true);
    expect(isDateInRange("2024-01-01", "2024-01-01", "2024-12-31")).toBe(true);
    expect(isDateInRange("2024-12-31", "2024-01-01", "2024-12-31")).toBe(true);
  });

  it("should return false when date is out of range", () => {
    expect(isDateInRange("2023-12-31", "2024-01-01", "2024-12-31")).toBe(false);
    expect(isDateInRange("2025-01-01", "2024-01-01", "2024-12-31")).toBe(false);
  });

  it("should handle partial ranges", () => {
    expect(isDateInRange("2024-06-15", "2024-01-01")).toBe(true);
    expect(isDateInRange("2024-06-15", undefined, "2024-12-31")).toBe(true);
    expect(isDateInRange("2024-06-15")).toBe(true);
  });
});
