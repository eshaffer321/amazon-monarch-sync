# amazon-order-scraper

Scrape Amazon order history with itemized details, prices, and transactions. Supports multiple accounts via profiles.

## Installation

```bash
npm install -g amazon-order-scraper

# Install Playwright browsers (required)
npx playwright install chromium
```

## Usage

### First-time Setup (Login)

```bash
# Interactive login - opens browser for you to log in
amazon-scraper --login

# For multiple accounts, use profiles
amazon-scraper --login --profile wife
```

### Fetch Orders

```bash
# Fetch orders from the last 30 days
amazon-scraper --days 30

# Fetch orders for a specific year
amazon-scraper --year 2024

# Fetch orders in a date range
amazon-scraper --since 2024-11-01 --until 2024-12-31

# Save to file
amazon-scraper --days 30 --output orders.json

# Use a specific profile
amazon-scraper --profile wife --days 30
```

### Headless Mode (for cron/automation)

```bash
# Run without visible browser (requires prior login)
amazon-scraper --profile erick --days 7 --headless --output orders.json
```

## CLI Options

| Option | Description |
|--------|-------------|
| `--year <year>` | Fetch orders for specific year (e.g., 2024) |
| `--since <date>` | Fetch orders since date (ISO format: 2024-01-01) |
| `--until <date>` | Fetch orders until date (ISO format: 2024-12-31) |
| `--days <n>` | Fetch orders from last N days |
| `--output <file>` | Write output to file |
| `--stdout` | Write to stdout (default) |
| `--include-pending` | Include orders not yet charged |
| `--profile <name>` | Use named profile (for multiple accounts) |
| `--login` | Interactive login mode |
| `--headless` | Run browser in headless mode |
| `--help` | Show help message |

## Output Format

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
          "last4": "1234",
          "description": "Visa ending in 1234 - charged $44.91"
        }
      ]
    }
  ]
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Scraping error |
| 2 | Login required |

## MCP Server

This package also includes an MCP (Model Context Protocol) server for use with Claude Code:

```json
{
  "mcpServers": {
    "amazon-scraper": {
      "command": "npx",
      "args": ["amazon-order-scraper"]
    }
  }
}
```

## VM/Server Deployment

For running on a headless server (e.g., Hetzner VM):

1. Install xvfb and VNC:
   ```bash
   apt install xvfb x11vnc
   Xvfb :99 -screen 0 1280x720x24 &
   export DISPLAY=:99
   x11vnc -display :99 -forever -nopw -listen 0.0.0.0 -rfbport 5900 &
   ```

2. Connect via VNC and run login:
   ```bash
   amazon-scraper --login --profile myaccount
   ```

3. Set up cron job for headless scraping:
   ```bash
   DISPLAY=:99 amazon-scraper --profile myaccount --days 7 --headless --output /data/orders.json
   ```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `BROWSER_DATA_DIR` | Base directory for browser profiles (default: `/tmp/amazon-monarch-sync`) |

## License

MIT
