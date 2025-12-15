/**
 * Core types for Amazon order data
 */

export interface OrderItem {
  name: string;
  price: string;
  quantity: string;
}

export interface Transaction {
  date: string;
  amount: string;
  type: "charge" | "refund" | "payment" | "credit";
  description: string;
}

export interface Order {
  orderId: string;
  orderDate: string;
  total: string;
  subtotal: string;
  tax: string;
  shipping: string;
  items: OrderItem[];
  transactions: Transaction[];
  transactionsUrl?: string;
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
