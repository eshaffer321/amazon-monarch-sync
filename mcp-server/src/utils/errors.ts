/**
 * Custom error classes for better error handling
 */

export class AmazonScraperError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AmazonScraperError";
  }
}

export class LoginRequiredError extends AmazonScraperError {
  constructor() {
    super(
      "Not logged in to Amazon. A browser window should be open - please log in there, then try again.",
      "LOGIN_REQUIRED"
    );
    this.name = "LoginRequiredError";
  }
}

export class NavigationError extends AmazonScraperError {
  constructor(url: string, originalError?: Error) {
    super(`Failed to navigate to ${url}`, "NAVIGATION_FAILED", {
      url,
      originalError: originalError?.message,
    });
    this.name = "NavigationError";
  }
}

export class ScrapingError extends AmazonScraperError {
  constructor(message: string, orderId?: string) {
    super(message, "SCRAPING_FAILED", { orderId });
    this.name = "ScrapingError";
  }
}

export class SuspiciousItemNameError extends AmazonScraperError {
  constructor(soldByLine: string, suspiciousLine: string) {
    super(
      `Amazon scraper found status/refund text where item name should be before "${soldByLine}": "${suspiciousLine}"`,
      "SUSPICIOUS_ITEM_NAME",
      { soldByLine, suspiciousLine }
    );
    this.name = "SuspiciousItemNameError";
  }
}

export class BrowserError extends AmazonScraperError {
  constructor(message: string) {
    super(message, "BROWSER_ERROR");
    this.name = "BrowserError";
  }
}
