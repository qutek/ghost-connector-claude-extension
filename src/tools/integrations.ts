import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { GhostClient } from "../ghost.js";
import { summarize, type SummaryItem } from "../lexical.js";
import { t, idSchema, type Loose } from "./_shared.js";

export function integrationsTools(client: () => GhostClient) {
  return [
    // ---- MEDIA ----
    t({
      name: "ghost_upload_image",
      description: "Upload an image to Ghost's media library. Pass a local file path; returns {url, ref}. Use returned URL for feature_image / inline images.",
      schema: z.object({
        path: z.string().describe("Absolute path to image file on disk."),
        purpose: z.literal("image").default("image"),
      }),
      run: async (args) => {
        const stat = await fs.stat(args.path);
        const MAX_IMAGE_BYTES = 25 * 1024 * 1024; // Ghost's image upload limit
        if (stat.size > MAX_IMAGE_BYTES) {
          throw new Error(`Image too large: ${stat.size} bytes (max ${MAX_IMAGE_BYTES}).`);
        }
        const buf = await fs.readFile(args.path);
        const filename = path.basename(args.path);
        const ext = path.extname(filename).toLowerCase();
        const ct: Record<string, string> = {
          ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
          ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
          ".avif": "image/avif",
        };
        const contentType = ct[ext] ?? "application/octet-stream";
        const r = (await client().uploadImage(buf, filename, contentType)) as { images?: unknown[] } | null;
        return r?.images?.[0] ?? null;
      },
    }),

    // ---- WEBHOOKS ----
    t({
      name: "ghost_list_webhooks",
      description: "List configured webhooks.",
      schema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
      run: async () => {
        const r = (await client().listWebhooks()) as { webhooks?: SummaryItem[] } | null;
        return summarize("webhooks", r?.webhooks ?? []);
      },
    }),
    t({
      name: "ghost_create_webhook",
      description: "Create a webhook. event, target_url, name required.",
      schema: z.object({
        name: z.string(),
        event: z.string().describe("e.g. 'post.published', 'member.added', 'member.deleted'."),
        target_url: z.string(),
        secret: z.string().optional(),
        api_version: z.string().default("v5.3"),
      }),
      run: async (args) => {
        const doc: Loose = { name: args.name, event: args.event, target_url: args.target_url };
        if (args.secret) doc.secret = args.secret;
        if (args.api_version) doc.api_version = args.api_version;
        const r = (await client().createWebhook(doc)) as { webhooks?: unknown[] } | null;
        return r?.webhooks?.[0];
      },
    }),
    t({
      name: "ghost_delete_webhook",
      description: "Delete a webhook by id.",
      schema: idSchema,
      annotations: { destructiveHint: true },
      run: async (args) => { await client().deleteWebhook(args.id); return { deleted: true, id: args.id }; },
    }),
  ];
}
