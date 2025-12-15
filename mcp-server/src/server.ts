import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { closeBrowserClient } from "./browser/client.js";
import {
  fetchAmazonOrders,
  getPageText,
  getPageHtml,
} from "./scrapers/index.js";

/**
 * MCP Server for Amazon order scraping
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: "amazon-monarch-sync",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "fetch_amazon_orders",
          description:
            "Fetch Amazon order history for a given year. Requires Chrome to be running with remote debugging enabled, or will launch a new browser (may need manual login).",
          inputSchema: {
            type: "object",
            properties: {
              year: {
                type: "string",
                description:
                  "Year to fetch orders for (e.g., '2024'). Defaults to current year.",
              },
            },
          },
        },
        {
          name: "get_amazon_page_html",
          description:
            "Debug tool - fetches the raw HTML of the Amazon order history page to see what we're working with",
          inputSchema: {
            type: "object",
            properties: {
              year: {
                type: "string",
                description: "Year to fetch (e.g., '2024')",
              },
              orderId: {
                type: "string",
                description:
                  "If provided, fetches the order details page for this order ID instead of the order history",
              },
            },
          },
        },
        {
          name: "close_browser",
          description: "Close the browser instance",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
        {
          name: "get_page_text",
          description:
            "Debug tool - fetches the text content (not HTML) of an Amazon order details page to analyze structure",
          inputSchema: {
            type: "object",
            properties: {
              orderId: {
                type: "string",
                description: "The order ID to fetch details for",
              },
            },
            required: ["orderId"],
          },
        },
      ],
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "fetch_amazon_orders") {
      const year =
        (args?.year as string) || new Date().getFullYear().toString();
      const result = await fetchAmazonOrders(year);

      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { success: true, orders: result.data.orders, errors: result.data.errors },
                null,
                2
              ),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }
    }

    if (name === "get_amazon_page_html") {
      try {
        const year = args?.year as string | undefined;
        const orderId = args?.orderId as string | undefined;
        const html = await getPageHtml(year, orderId);

        return {
          content: [
            {
              type: "text",
              text:
                html.substring(0, 15000) +
                "\n\n... (truncated, total length: " +
                html.length +
                ")",
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            { type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` },
          ],
        };
      }
    }

    if (name === "close_browser") {
      await closeBrowserClient();
      return {
        content: [{ type: "text", text: "Browser closed" }],
      };
    }

    if (name === "get_page_text") {
      const orderId = args?.orderId as string;
      if (!orderId) {
        return {
          content: [{ type: "text", text: "Error: orderId is required" }],
        };
      }

      try {
        const pageText = await getPageText(orderId);
        return {
          content: [
            {
              type: "text",
              text:
                pageText.substring(0, 20000) +
                (pageText.length > 20000 ? "\n\n... (truncated)" : ""),
            },
          ],
        };
      } catch (e) {
        return {
          content: [
            { type: "text", text: `Error: ${e instanceof Error ? e.message : String(e)}` },
          ],
        };
      }
    }

    return {
      content: [{ type: "text", text: `Unknown tool: ${name}` }],
    };
  });

  return server;
}
