import { describe, expect, it, vi } from "vitest";
import type { Page } from "playwright";
import { scrapeOrderList } from "../src/scrapers/orders.js";

describe("scrapeOrderList", () => {
  it("follows Amazon order-history pagination", async () => {
    const pages = [
      {
        orders: [
          {
            orderId: "112-1111111-1111111",
            orderDate: "June 26, 2026",
            total: "$10.00",
            detailsUrl:
              "https://www.amazon.com/gp/your-account/order-details?orderID=112-1111111-1111111",
          },
        ],
        nextUrl:
          "https://www.amazon.com/gp/your-account/order-history?orderFilter=year-2026&startIndex=10",
      },
      {
        orders: [
          {
            orderId: "112-2222222-2222222",
            orderDate: "June 12, 2026",
            total: "$20.00",
            detailsUrl:
              "https://www.amazon.com/gp/your-account/order-details?orderID=112-2222222-2222222",
          },
        ],
        nextUrl: "",
      },
    ];

    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn(),
      evaluate: vi.fn(async () => pages.shift()),
    } as unknown as Page;

    const orders = await scrapeOrderList(page, "2026");

    expect(orders.map((order) => order.orderId)).toEqual([
      "112-1111111-1111111",
      "112-2222222-2222222",
    ]);
    expect(page.goto).toHaveBeenCalledTimes(2);
    expect(page.goto).toHaveBeenLastCalledWith(
      "https://www.amazon.com/gp/your-account/order-history?orderFilter=year-2026&startIndex=10",
      { waitUntil: "domcontentloaded", timeout: 30000 }
    );
  });

  it("filters by date range and stops after reaching orders before since", async () => {
    const pages = [
      {
        orders: [
          {
            orderId: "112-1111111-1111111",
            orderDate: "June 26, 2026",
            total: "$10.00",
            detailsUrl:
              "https://www.amazon.com/gp/your-account/order-details?orderID=112-1111111-1111111",
          },
        ],
        nextUrl:
          "https://www.amazon.com/gp/your-account/order-history?orderFilter=year-2026&startIndex=10",
      },
      {
        orders: [
          {
            orderId: "112-2222222-2222222",
            orderDate: "June 12, 2026",
            total: "$20.00",
            detailsUrl:
              "https://www.amazon.com/gp/your-account/order-details?orderID=112-2222222-2222222",
          },
          {
            orderId: "112-3333333-3333333",
            orderDate: "May 20, 2026",
            total: "$30.00",
            detailsUrl:
              "https://www.amazon.com/gp/your-account/order-details?orderID=112-3333333-3333333",
          },
        ],
        nextUrl:
          "https://www.amazon.com/gp/your-account/order-history?orderFilter=year-2026&startIndex=20",
      },
      {
        orders: [
          {
            orderId: "112-4444444-4444444",
            orderDate: "May 10, 2026",
            total: "$40.00",
            detailsUrl:
              "https://www.amazon.com/gp/your-account/order-details?orderID=112-4444444-4444444",
          },
        ],
        nextUrl: "",
      },
    ];

    const page = {
      goto: vi.fn(),
      waitForTimeout: vi.fn(),
      evaluate: vi.fn(async () => pages.shift()),
    } as unknown as Page;

    const orders = await scrapeOrderList(page, "2026", {
      since: "2026-05-27",
      until: "2026-06-26",
    });

    expect(orders.map((order) => order.orderId)).toEqual([
      "112-1111111-1111111",
      "112-2222222-2222222",
    ]);
    expect(page.goto).toHaveBeenCalledTimes(2);
  });
});
