import { z } from "zod";
import { GhostClient } from "../ghost.js";
import { buildContentFields, summarize, type SummaryItem } from "../lexical.js";
import { t, listSchema, contentSchema, idSchema, type Loose } from "./_shared.js";

export function pagesTools(client: () => GhostClient) {
  return [
    t({
      name: "ghost_list_pages",
      description: "List pages. Same params as ghost_list_posts.",
      schema: listSchema.omit({ fields: true }),
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().listPages(args)) as { pages?: SummaryItem[] } | null;
        return summarize("pages", r?.pages ?? []);
      },
    }),
    t({
      name: "ghost_get_page",
      description: "Fetch a single page by id.",
      schema: z.object({ id: z.string(), include: z.string().optional() }),
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().getPage(args.id, { include: args.include })) as { pages?: unknown[] } | null;
        return r?.pages?.[0] ?? null;
      },
    }),
    t({
      name: "ghost_create_page",
      description: "Create a page (not a post). Same body shape as ghost_create_post.",
      schema: contentSchema.extend({
        title: z.string(),
        excerpt: z.string().optional(),
        feature_image: z.string().optional(),
        status: z.enum(["draft", "published"]).default("draft"),
      }),
      run: async (args) => {
        const doc: Loose = { title: args.title, status: args.status };
        Object.assign(doc, buildContentFields(args));
        for (const k of ["excerpt", "feature_image"] as const) if (args[k] !== undefined) doc[k] = args[k];
        const r = (await client().createPage(doc)) as { pages?: unknown[] } | null;
        return r?.pages?.[0];
      },
    }),
    t({
      name: "ghost_update_page",
      description: "Update a page by id. Requires updated_at.",
      schema: contentSchema.extend({
        id: z.string(),
        updated_at: z.string(),
        title: z.string().optional(),
        excerpt: z.string().optional(),
        feature_image: z.string().optional(),
        status: z.enum(["draft", "published"]).optional(),
      }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const doc: Loose = {};
        Object.assign(doc, buildContentFields(args));
        for (const k of ["title", "excerpt", "feature_image", "status"] as const) {
          if (args[k] !== undefined) doc[k] = args[k];
        }
        const r = (await client().updatePage(args.id, doc, args.updated_at)) as { pages?: unknown[] } | null;
        return r?.pages?.[0];
      },
    }),
    t({
      name: "ghost_delete_page",
      description: "Permanently delete a page by id. Confirm first.",
      schema: idSchema,
      annotations: { destructiveHint: true },
      run: async (args) => { await client().deletePage(args.id); return { deleted: true, id: args.id }; },
    }),
  ];
}
