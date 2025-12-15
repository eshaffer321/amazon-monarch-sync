import { describe, it, expect } from "vitest";
import { parseItems, parseOrderSummary } from "../src/scrapers/parsers.js";

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
    expect(items[0].quantity).toBe("1");
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
});
