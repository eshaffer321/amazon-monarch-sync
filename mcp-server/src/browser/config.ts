import type { BrowserConfig } from "../types/index.js";

const BASE_DATA_DIR = process.env.BROWSER_DATA_DIR || "/tmp/amazon-monarch-sync";

/**
 * Get the browser data directory for a profile
 */
export function getProfileDataDir(profile?: string): string {
  if (profile) {
    return `${BASE_DATA_DIR}-${profile}`;
  }
  // Default profile uses legacy path for backwards compatibility
  return `${BASE_DATA_DIR}-browser`;
}

/**
 * Default browser configuration
 */
export const DEFAULT_CONFIG: BrowserConfig = {
  headless: false,
  userDataDir: getProfileDataDir(),
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
