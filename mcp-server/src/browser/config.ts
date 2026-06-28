import type { BrowserConfig } from "../types/index.js";
import { homedir } from "os";
import { join } from "path";
import { existsSync } from "fs";

function getDefaultDataDir(): string {
  // Use BROWSER_DATA_DIR env var if set, otherwise default to ~/.itemize/amazon
  if (process.env.BROWSER_DATA_DIR) {
    return process.env.BROWSER_DATA_DIR;
  }
  return join(homedir(), ".itemize", "amazon");
}

const BASE_DATA_DIR = getDefaultDataDir();

/**
 * Get the browser data directory for a profile
 */
export function getProfileDataDir(profile?: string): string {
  if (profile) {
    return join(BASE_DATA_DIR, profile);
  }
  // Default profile
  return join(BASE_DATA_DIR, "default");
}

/**
 * Check if a profile is already authenticated (profile directory exists)
 */
export function isProfileAuthenticated(profile?: string): boolean {
  const profileDir = getProfileDataDir(profile);
  return existsSync(profileDir);
}

/**
 * Get default headless mode.
 * Defaults to false — Amazon detects and bot-flags headless Chromium, which
 * invalidates sessions quickly. Pass --headless explicitly for cron/CI runs.
 */
export function getDefaultHeadlessMode(_profile?: string): boolean {
  // Explicit env var overrides everything
  if (process.env.BROWSER_HEADLESS !== undefined) {
    return process.env.BROWSER_HEADLESS === "true";
  }
  return false;
}

/**
 * Default browser configuration
 */
export const DEFAULT_CONFIG: BrowserConfig = {
  headless: false, // Will be overridden by client based on profile
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
