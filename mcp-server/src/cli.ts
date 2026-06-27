#!/usr/bin/env node

import { writeFileSync } from "fs";
import { fetchAmazonOrders, interactiveLogin } from "./scrapers/index.js";
import { closeBrowserClient, initBrowserClient } from "./browser/client.js";
import { isDateInRange } from "./utils/patterns.js";
import type { CLIOptions, Order } from "./types/index.js";

const EXIT_SUCCESS = 0;
const EXIT_ERROR = 1;
const EXIT_LOGIN_REQUIRED = 2;

function printUsage(): void {
  console.log(`
amazon-scraper - Scrape Amazon order history

Usage:
  amazon-scraper [options]

Options:
  --year <year>       Fetch orders for specific year (e.g., 2024)
  --since <date>      Fetch orders since date (ISO format: 2024-01-01)
  --until <date>      Fetch orders until date (ISO format: 2024-12-31)
  --days <n>          Fetch orders from last N days
  --output <file>     Write output to file
  --stdout            Write to stdout (default)
  --include-pending   Include orders not yet charged
  --profile <name>    Use named profile (for multiple accounts)
  --login             Interactive login mode (opens browser, waits for login)
  --headless          Run browser in headless mode (for cron/automated runs)
  --help              Show this help message

Examples:
  amazon-scraper --year 2024
  amazon-scraper --days 30
  amazon-scraper --profile wife --days 30
  amazon-scraper --login --profile wife
  amazon-scraper --profile erick --days 7 --headless --output orders.json

Exit codes:
  0 - Success
  1 - Scraping error
  2 - Login required
`);
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    stdout: true,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const next = args[i + 1];

    switch (arg) {
      case "--year":
        options.year = next;
        i++;
        break;
      case "--since":
        options.since = next;
        i++;
        break;
      case "--until":
        options.until = next;
        i++;
        break;
      case "--days":
        options.days = parseInt(next, 10);
        i++;
        break;
      case "--output":
        options.output = next;
        options.stdout = false;
        i++;
        break;
      case "--stdout":
        options.stdout = true;
        break;
      case "--include-pending":
        options.includePending = true;
        break;
      case "--profile":
        options.profile = next;
        i++;
        break;
      case "--login":
        options.login = true;
        break;
      case "--headless":
        options.headless = true;
        break;
      case "--help":
      case "-h":
        printUsage();
        process.exit(EXIT_SUCCESS);
    }
  }

  return options;
}

function calculateDateRange(options: CLIOptions): { since?: string; until?: string } {
  if (options.days) {
    const now = new Date();
    const since = new Date(now);
    since.setDate(since.getDate() - options.days);
    return {
      since: since.toISOString().split("T")[0],
      until: now.toISOString().split("T")[0],
    };
  }

  return {
    since: options.since,
    until: options.until,
  };
}

function getYearToFetch(options: CLIOptions): string {
  if (options.year) {
    return options.year;
  }

  // If using --since, use that year
  if (options.since) {
    return options.since.split("-")[0];
  }

  // Default to current year
  return new Date().getFullYear().toString();
}

function filterOrdersByDate(orders: Order[], since?: string, until?: string): Order[] {
  if (!since && !until) {
    return orders;
  }

  return orders.filter((order) => isDateInRange(order.orderDate, since, until));
}

async function runLogin(options: CLIOptions): Promise<void> {
  console.log(`Starting interactive login for profile: ${options.profile || "default"}`);
  console.log("A browser window will open. Please log in to Amazon.");
  console.log("Press Ctrl+C to cancel.\n");

  // Initialize browser with profile settings
  initBrowserClient({
    profile: options.profile,
    headless: false, // Always visible for login
  });

  let exitCode = EXIT_ERROR;
  try {
    const success = await interactiveLogin();
    if (success) {
      console.log("\n✓ Login successful! Session saved.");
      console.log(`  Profile: ${options.profile || "default"}`);
      exitCode = EXIT_SUCCESS;
    } else {
      console.error("\n✗ Login timed out or failed.");
      exitCode = EXIT_LOGIN_REQUIRED;
    }
  } finally {
    await closeBrowserClient();
  }
  process.exit(exitCode);
}

async function runScraper(options: CLIOptions): Promise<void> {
  const year = getYearToFetch(options);
  const { since, until } = calculateDateRange(options);

  // Initialize browser with profile/headless settings
  initBrowserClient({
    profile: options.profile,
    headless: options.headless,
  });

  let exitCode = EXIT_ERROR;
  try {
    const result = await fetchAmazonOrders(year, { since, until });

    if (!result.success) {
      if ("needsLogin" in result && result.needsLogin) {
        console.error("Error: Login required.");
        console.error(`Run: amazon-scraper --login${options.profile ? ` --profile ${options.profile}` : ""}`);
        exitCode = EXIT_LOGIN_REQUIRED;
        return;
      }
      console.error(`Error: ${result.error}`);
      return;
    }

    // Filter by date range
    let orders = result.data.orders;
    orders = filterOrdersByDate(orders, since, until);

    // Filter out pending if not requested
    if (!options.includePending) {
      orders = orders.filter((o) => o.transactions.length > 0);
    }

    const output = JSON.stringify({ orders }, null, 2);

    if (options.output) {
      writeFileSync(options.output, output);
      console.error(`Wrote ${orders.length} orders to ${options.output}`);
    } else {
      console.log(output);
    }

    exitCode = EXIT_SUCCESS;
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    exitCode = EXIT_ERROR;
  } finally {
    await closeBrowserClient();
  }
  process.exit(exitCode);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    printUsage();
    process.exit(EXIT_ERROR);
  }

  const options = parseArgs(args);

  if (options.login) {
    await runLogin(options);
  } else {
    await runScraper(options);
  }
}

main();
