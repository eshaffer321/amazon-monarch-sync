import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright";
import { scrapeOrderDetails } from "../src/scrapers/order-details.js";

describe("scrapeOrderDetails", () => {
  it("prefers DOM-extracted purchased items over poisoned page text", async () => {
    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn(),
      evaluate: vi.fn(async () => ({
        pageText: `
Delivered June 29
Your package was left near the front door or porch.
Sold by: Amazon.com
$9.99

Refunded
There's no need to return your item. Your refund has been issued.
Sold by: Amazon.com
$9.99
        `,
        transactionUrls: [],
        items: [
          {
            name: "Munchkin Perfect Angle Straw Cups Toddlers 1-3 - Teal",
            price: "$9.99",
            quantity: 1,
          },
          {
            name: "Munchkin Perfect Angle Straw Cups Toddlers 1-3 - Dark Blue",
            price: "$9.99",
            quantity: 1,
          },
        ],
        shipments: [
          {
            status: "Delivered",
            date: "",
            items: [
              {
                name: "Munchkin Perfect Angle Straw Cups Toddlers 1-3 - Teal",
                price: "$9.99",
                quantity: 1,
              },
            ],
          },
        ],
      })),
    } as unknown as Page;

    const order = await scrapeOrderDetails(page, {
      orderId: "112-2338247-0032223",
      orderDate: "June 27, 2026",
      total: "$52.95",
      detailsUrl:
        "https://www.amazon.com/gp/your-account/order-details?orderID=112-2338247-0032223",
    });

    expect(order.items).toHaveLength(2);
    expect(order.items.map((item) => item.name)).toEqual([
      "Munchkin Perfect Angle Straw Cups Toddlers 1-3 - Teal",
      "Munchkin Perfect Angle Straw Cups Toddlers 1-3 - Dark Blue",
    ]);
    expect(order.items.map((item) => item.name).join("\n")).not.toContain(
      "front door or porch"
    );
    expect(order.items.map((item) => item.name).join("\n")).not.toContain(
      "refund has been issued"
    );
    expect(order.shipments).toHaveLength(1);
    expect(order.shipments[0].items[0].name).toContain("Munchkin");
  });
});
