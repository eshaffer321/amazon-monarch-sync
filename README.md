# amazon-monarch-sync

Scrape your Amazon order history with full itemized details, prices, and transaction information. Perfect for expense tracking, financial audits, and integration with tools like Monarch Money.

## Features

- Scrapes Amazon order history with complete itemization (items, prices, quantities)
- Captures transaction details (payment method, amounts, dates)
- Supports multiple Amazon accounts via profiles
- CLI tool for one-off scraping or automation
- MCP (Model Context Protocol) server for integration with Claude Code
- Headless mode for cron jobs and server deployments
- Session persistence for repeated use without re-login

## Project Structure

```
amazon-monarch-sync/
├── mcp-server/          # Main package - CLI and MCP server
│   ├── src/             # TypeScript source
│   ├── dist/            # Compiled JavaScript (generated)
│   ├── package.json     # Dependencies and scripts
│   └── README.md        # Detailed usage documentation
├── .gitignore
└── README.md            # This file
```

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/eshaffer321/amazon-monarch-sync
cd amazon-monarch-sync

# Install dependencies
npm install --prefix mcp-server

# Install Playwright browsers (required for scraping)
npx playwright install chromium
```

### Basic Usage

```bash
# Login to Amazon (interactive - opens browser)
npm --prefix mcp-server run cli -- --login

# Fetch orders from the last 30 days
npm --prefix mcp-server run cli -- --days 30

# Fetch orders and save to JSON
npm --prefix mcp-server run cli -- --days 30 --output orders.json
```

### Multiple Accounts

```bash
# Login to a different profile
npm --prefix mcp-server run cli -- --login --profile spouse

# Fetch orders for that profile
npm --prefix mcp-server run cli -- --profile spouse --days 30
```

## Installation as Global Tool

```bash
npm install -g amazon-order-scraper
npx playwright install chromium

# Now you can use it directly
amazon-scraper --days 30
amazon-scraper --login --profile myaccount
```

## Development

```bash
cd mcp-server

# Build TypeScript
npm run build

# Watch mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## Configuration

Browser profile data is stored in `/tmp/amazon-monarch-sync` by default. This contains session cookies for authenticated requests.

For custom storage location, set the `BROWSER_DATA_DIR` environment variable:

```bash
BROWSER_DATA_DIR=/custom/path amazon-scraper --days 30
```

## Output Format

Orders are returned as JSON with the following structure:

```json
{
  "orders": [
    {
      "orderId": "111-1234567-8901234",
      "orderDate": "2024-11-24",
      "total": "$44.91",
      "subtotal": "$42.37",
      "tax": "$2.54",
      "shipping": "$0.00",
      "items": [
        {
          "name": "Product Name",
          "price": "$9.99",
          "quantity": 1
        }
      ],
      "transactions": [
        {
          "date": "2024-11-24",
          "amount": "$44.91",
          "type": "charge",
          "last4": "1234"
        }
      ]
    }
  ]
}
```

## Documentation

See [mcp-server/README.md](./mcp-server/README.md) for complete CLI documentation, including:
- All CLI options
- Date filtering options
- Headless mode and server deployment
- MCP server configuration
- Exit codes

## Architecture

- **CLI**: Command-line interface for scraping Amazon orders
- **MCP Server**: Model Context Protocol server that exposes scraping functions to Claude Code
- **Playwright**: Browser automation library for navigating Amazon and extracting data

## License

MIT

## Contributing

Issues and pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
