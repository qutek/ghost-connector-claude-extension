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
      name: "ghost_create_webhook",
      description: "Create a webhook. Required: event + target_url. Optional: name, secret, api_version.",
      schema: z.object({
        event: z.string().describe("e.g. 'post.published', 'post.added', 'member.added', 'member.deleted'."),
        target_url: z.string().describe("HTTPS URL Ghost will POST to on trigger."),
        name: z.string().optional(),
        secret: z.string().optional(),
        api_version: z.string().default("v5.3"),
      }),
      run: async (args) => {
        const doc: Loose = { event: args.event, target_url: args.target_url };
        if (args.name) doc.name = args.name;
        if (args.secret) doc.secret = args.secret;
        if (args.api_version) doc.api_version = args.api_version;
        const r = (await client().createWebhook(doc)) as { webhooks?: unknown[] } | null;
        return r?.webhooks?.[0];
      },
    }),
    t({
      name: "ghost_update_webhook",
      description: "Update an existing webhook. Pass any writable field: event, target_url, name, api_version.",
      schema: z.object({
        id: z.string(),
        event: z.string().optional().describe("e.g. 'post.published', 'member.added'."),
        target_url: z.string().optional(),
        name: z.string().optional(),
        api_version: z.string().optional(),
      }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const doc: Loose = {};
        if (args.event) doc.event = args.event;
        if (args.target_url) doc.target_url = args.target_url;
        if (args.name) doc.name = args.name;
        if (args.api_version) doc.api_version = args.api_version;
        const r = (await client().updateWebhook(args.id, doc)) as { webhooks?: unknown[] } | null;
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
