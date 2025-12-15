import type { BrowserConfig } from "../types/index.js";

/**
 * Default browser configuration
 */
export const DEFAULT_CONFIG: BrowserConfig = {
  headless: false,
  userDataDir: process.env.BROWSER_DATA_DIR || "/tmp/amazon-monarch-sync-browser",
  viewport: {
    width: 1280,
    height: 800,
  },
  navigationTimeout: 15000,
  pageLoadDelay: 2000,
};

/**
 * Amazon URLs
 */
export const AMAZON_URLS = {
  orderHistory: (year: string) =>
    `https://www.amazon.com/gp/your-account/order-history?orderFilter=year-${year}`,
  orderDetails: (orderId: string) =>
    `https://www.amazon.com/gp/your-account/order-details?orderID=${orderId}`,
} as const;
