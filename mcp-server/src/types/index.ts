/**
 * Core types for Amazon order data
 */

export interface OrderItem {
  name: string;
  price: string;
  quantity: number;
}

export interface Transaction {
  date: string; // ISO format: YYYY-MM-DD
  amount: string;
  type: "charge" | "refund" | "payment" | "credit";
  last4: string; // Last 4 digits of card
  description: string;
}

export interface Shipment {
  status: string;      // "Delivered", "Arriving", "Shipped"
  date: string;        // ISO date from status line (delivery/arrival date)
  items: OrderItem[];
}

export interface Order {
  orderId: string;
  orderDate: string; // ISO format: YYYY-MM-DD
  total: string;
  subtotal: string;
  tax: string;
  shipping: string;
  items: OrderItem[];          // flat list of all items (backward compat)
  shipments: Shipment[];       // items grouped by shipment; [] if not parseable
  transactions: Transaction[];
  transactionsUrl?: string;
}

/**
 * CLI options
 */
export interface CLIOptions {
  year?: string;
  since?: string; // ISO date
  until?: string; // ISO date
  days?: number;
  output?: string;
  stdout?: boolean;
  includePending?: boolean;
  profile?: string; // Profile name for multi-account support
  login?: boolean; // Interactive login mode
  headless?: boolean; // Run browser in headless mode
}

export interface OrderSummary {
  orderId: string;
  orderDate: string;
  total: string;
  detailsUrl: string;
}

export interface ScrapeResult<T> {
  success: true;
  data: T;
}

export interface ScrapeError {
  success: false;
  error: string;
  needsLogin?: boolean;
}

export type ScrapeResponse<T> = ScrapeResult<T> | ScrapeError;

export interface FetchOrdersResult {
  orders: Order[];
  errors?: string[];
}

/**
 * Browser configuration
 */
export interface BrowserConfig {
  headless: boolean;
  userDataDir: string;
  viewport: {
    width: number;
    height: number;
  };
  navigationTimeout: number;
  pageLoadDelay: number;
}
