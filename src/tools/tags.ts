import { z } from "zod";
import { GhostClient } from "../ghost.js";
import { summarize, type SummaryItem } from "../lexical.js";
import { t, idSchema, type Loose } from "./_shared.js";

export function tagsTools(client: () => GhostClient) {
  return [
    t({
      name: "ghost_list_tags",
      description: "List tags. Filter e.g. 'visibility:public'.",
      schema: z.object({
        filter: z.string().optional(),
        limit: z.number().optional(),
        page: z.number().optional(),
        order: z.string().optional(),
        include: z.string().optional().describe("e.g. 'count.posts'."),
      }),
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().listTags(args)) as { tags?: SummaryItem[] } | null;
        return summarize("tags", r?.tags ?? []);
      },
    }),
    t({
      name: "ghost_get_tag",
      description: "Fetch a single tag by id.",
      schema: idSchema,
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().getTag(args.id)) as { tags?: unknown[] } | null;
        return r?.tags?.[0] ?? null;
      },
    }),
    t({
      name: "ghost_create_tag",
      description: "Create a tag. name required.",
      schema: z.object({
        name: z.string(),
        slug: z.string().optional(),
        description: z.string().optional(),
        accent_color: z.string().optional().describe("Hex without #, e.g. 'ff0000'."),
        visibility: z.enum(["public", "internal"]).default("public"),
        feature_image: z.string().optional(),
      }),
      run: async (args) => {
        const doc: Loose = { name: args.name };
        for (const k of ["slug", "description", "accent_color", "visibility", "feature_image"] as const) {
          if (args[k] !== undefined) doc[k] = args[k];
        }
        const r = (await client().createTag(doc)) as { tags?: unknown[] } | null;
        return r?.tags?.[0];
      },
    }),
    t({
      name: "ghost_update_tag",
      description: "Update a tag by id.",
      schema: z.object({
        id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        description: z.string().optional(),
        accent_color: z.string().optional(),
        visibility: z.enum(["public", "internal"]).optional(),
        feature_image: z.string().optional(),
      }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const { id, ...rest } = args;
        const doc: Loose = {};
        for (const k of ["name", "slug", "description", "accent_color", "visibility", "feature_image"] as const) {
          if (rest[k] !== undefined) doc[k] = rest[k];
        }
        const r = (await client().updateTag(id, doc)) as { tags?: unknown[] } | null;
        return r?.tags?.[0];
      },
    }),
    t({
      name: "ghost_delete_tag",
      description: "Permanently delete a tag by id. Confirm first.",
      schema: idSchema,
      annotations: { destructiveHint: true },
      run: async (args) => { await client().deleteTag(args.id); return { deleted: true, id: args.id }; },
    }),
  ];
}
