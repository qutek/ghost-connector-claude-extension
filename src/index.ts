"use strict";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { ZodRawShape } from "zod";
import { GhostClient, type GhostApiError } from "./ghost.js";
import { type ToolDef } from "./tools/_shared.js";
import { postsTools } from "./tools/posts.js";
import { pagesTools } from "./tools/pages.js";
import { tagsTools } from "./tools/tags.js";
import { authorsTools } from "./tools/authors.js";
import { membersTools } from "./tools/members.js";
import { siteTools } from "./tools/site.js";
import { integrationsTools } from "./tools/integrations.js";
import { metaTools } from "./tools/meta.js";

const blogUrl = process.env.GHOST_URL;
const adminKey = process.env.GHOST_API_KEY;

function requireConfig(): void {
  if (!blogUrl || !adminKey) {
    throw new Error(
      "Ghost MCP server not configured. Set GHOST_URL (your blog base URL, e.g. https://myblog.ghost.io) " +
      "and GHOST_API_KEY (Staff Admin API key from Ghost admin > Integrations > Custom Integration, format '<id>:<secret>')."
    );
  }
}

let _client: GhostClient | null = null;
function client(): GhostClient {
  if (_client) return _client;
  requireConfig();
  _client = new GhostClient({ blogUrl: blogUrl!, adminKey: adminKey! });
  return _client;
}

// ---- Tool registry: composed from domain modules ----
// Schemas are z.object instances; McpServer.registerTool wants a raw shape.
type AnyTool = ToolDef<any>;
const TOOLS: AnyTool[] = [
  ...postsTools(client),
  ...pagesTools(client),
  ...tagsTools(client),
  ...authorsTools(client),
  ...membersTools(client),
  ...siteTools(client),
  ...integrationsTools(client),
  ...metaTools(client, blogUrl),
];

// ---- Server setup (high-level McpServer API) ----
const server = new McpServer(
  { name: "ghost-connector", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

function asText(data: unknown): string {
  return typeof data === "string" ? data : JSON.stringify(data, null, 2);
}

for (const tool of TOOLS) {
  const shape = tool.schema.shape as ZodRawShape;
  server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: shape,
      annotations: tool.annotations ?? {},
    },
    async (rawArgs: Record<string, unknown>) => {
      try {
        const parsed = tool.schema.parse(rawArgs);
        const result = await tool.run(parsed);
        return {
          content: [{ type: "text" as const, text: asText(result) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: "text" as const, text: msg }],
        };
      }
    },
  );
}

async function main(): Promise<void> {
  try {
    requireConfig();
  } catch (err) {
    console.warn("[ghost-connector]", err instanceof Error ? err.message : err);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const e = err as GhostApiError;
  console.error("[ghost-connector] fatal:", e?.stack || err);
  process.exit(1);
});
