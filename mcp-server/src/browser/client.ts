import { chromium, type BrowserContext, type Page } from "playwright";
import { DEFAULT_CONFIG, getProfileDataDir } from "./config.js";
import { BrowserError } from "../utils/errors.js";
import type { BrowserConfig } from "../types/index.js";

export interface BrowserInitOptions {
  profile?: string;
  headless?: boolean;
}

/**
 * Manages Playwright browser lifecycle with persistent context
 */
export class BrowserClient {
  private context: BrowserContext | null = null;
  private config: BrowserConfig;

  constructor(config: Partial<BrowserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get or create the browser context
   */
  async getContext(): Promise<BrowserContext> {
    if (!this.context) {
      try {
        this.context = await chromium.launchPersistentContext(
          this.config.userDataDir,
          {
            headless: this.config.headless,
            viewport: this.config.viewport,
          }
        );
      } catch (error) {
        throw new BrowserError(
          `Failed to launch browser: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
    return this.context;
  }

  /**
   * Create a new page in the browser context
   */
  async newPage(): Promise<Page> {
    const context = await this.getContext();
    return context.newPage();
  }

  /**
   * Navigate to a URL with standard options
   */
  async navigateTo(page: Page, url: string): Promise<void> {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: this.config.navigationTimeout,
    });
    await page.waitForTimeout(this.config.pageLoadDelay);
  }

  /**
   * Check if Amazon login is required
   */
  async isLoginRequired(page: Page): Promise<boolean> {
    const loginForm = await page.$('#ap_email, input[name="email"]');
    return loginForm !== null;
  }

  /**
   * Wait for user to complete login (up to timeout)
   * Returns true if login succeeded, false if timed out
   */
  async waitForLogin(page: Page, timeoutMs: number = 120000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 2000;

    while (Date.now() - startTime < timeoutMs) {
      // Check if we're no longer on a login page
      const stillOnLogin = await this.isLoginRequired(page);
      if (!stillOnLogin) {
        // Give the page a moment to fully load after login
        await page.waitForTimeout(2000);
        return true;
      }
      await page.waitForTimeout(checkInterval);
    }
    return false;
  }

  /**
   * Close the browser and clean up
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): BrowserConfig {
    return { ...this.config };
  }
}

// Singleton instance for the MCP server
let browserClient: BrowserClient | null = null;
let currentInitOptions: BrowserInitOptions = {};

/**
 * Initialize the browser client with specific options
 * Must be called before getBrowserClient() if using custom profile/headless
 */
export function initBrowserClient(options: BrowserInitOptions): void {
  // If client exists with different options, close it
  if (browserClient) {
    const needsReinit =
      currentInitOptions.profile !== options.profile ||
      currentInitOptions.headless !== options.headless;
    if (needsReinit) {
      browserClient.close();
      browserClient = null;
    }
  }
  currentInitOptions = options;
}

export function getBrowserClient(): BrowserClient {
  if (!browserClient) {
    const config: Partial<BrowserConfig> = {
      userDataDir: getProfileDataDir(currentInitOptions.profile),
      headless: currentInitOptions.headless ?? false,
    };
    browserClient = new BrowserClient(config);
  }
  return browserClient;
}

export async function closeBrowserClient(): Promise<void> {
  if (browserClient) {
    await browserClient.close();
    browserClient = null;
  }
}
