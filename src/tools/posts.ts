import { z } from "zod";

import { GhostClient } from "../ghost.js";
import { buildContentFields, summarize, type SummaryItem } from "../lexical.js";
import { t, listSchema, contentSchema, type Loose } from "./_shared.js";

export function postsTools(client: () => GhostClient) {
  return [

    t({
      name: "ghost_list_posts",
      description: "List blog posts. Returns id/title/slug/status/updated_at for each (max 50). Use filter, page, limit, order, include (e.g. 'tags,authors').",
      schema: listSchema,
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().listPosts(args)) as { posts?: SummaryItem[] } | null;
        return summarize("posts", r?.posts ?? []);
      },
    }),
    t({
      name: "ghost_get_post",
      description: "Fetch a single post by id. Use include='tags,authors' for full detail.",
      schema: z.object({ id: z.string(), include: z.string().optional(), fields: z.string().optional() }),
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().getPost(args.id, { include: args.include, fields: args.fields })) as { posts?: unknown[] } | null;
        return r?.posts?.[0] ?? null;
      },
    }),
    t({
      name: "ghost_create_post",
      description: "Create a draft post. Pass title (required) plus mobiledoc/lexical/html, excerpt, tags (ids), authors (ids), feature_image, etc. Returns created post.",
      schema: contentSchema.extend({
        title: z.string(),
        excerpt: z.string().optional(),
        feature_image: z.string().optional().describe("URL."),
        featured: z.boolean().default(false),
        status: z.enum(["draft", "published"]).default("draft"),
        tag_ids: z.array(z.string()).optional(),
        author_ids: z.array(z.string()).optional(),
        meta_title: z.string().optional(),
        meta_description: z.string().optional(),
        published_at: z.string().optional().describe("ISO 8601; omit for now."),
      }),
      run: async (args) => {
        const doc: Loose = { title: args.title, status: args.status };
        Object.assign(doc, buildContentFields(args));
        for (const k of ["excerpt", "feature_image", "featured", "meta_title", "meta_description", "published_at"] as const) {
          if (args[k] !== undefined) doc[k] = args[k];
        }
        if (args.tag_ids?.length) doc.tags = args.tag_ids.map((id) => ({ id }));
        if (args.author_ids?.length) doc.authors = args.author_ids.map((id) => ({ id }));
        const r = (await client().createPost(doc)) as { posts?: unknown[] } | null;
        return r?.posts?.[0];
      },
    }),
    t({
      name: "ghost_update_post",
      description: "Update an existing post by id. Requires the post's current updated_at (fetch via ghost_get_post first). Pass only fields to change.",
      schema: contentSchema.extend({
        id: z.string(),
        updated_at: z.string().describe("Current updated_at from ghost_get_post."),
        title: z.string().optional(),
        excerpt: z.string().optional(),
        feature_image: z.string().optional(),
        featured: z.boolean().optional(),
        status: z.enum(["draft", "published", "scheduled"]).optional(),
        tag_ids: z.array(z.string()).optional(),
        author_ids: z.array(z.string()).optional(),
        meta_title: z.string().optional(),
        meta_description: z.string().optional(),
        published_at: z.string().optional(),
      }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const doc: Loose = {};
        Object.assign(doc, buildContentFields(args));
        for (const k of ["title", "excerpt", "feature_image", "featured", "status", "meta_title", "meta_description", "published_at"] as const) {
          if (args[k] !== undefined) doc[k] = args[k];
        }
        if (args.tag_ids?.length) doc.tags = args.tag_ids.map((id) => ({ id }));
        if (args.author_ids?.length) doc.authors = args.author_ids.map((id) => ({ id }));
        const r = (await client().updatePost(args.id, doc, args.updated_at)) as { posts?: unknown[] } | null;
        return r?.posts?.[0];
      },
    }),
    t({
      name: "ghost_delete_post",
      description: "Permanently delete a post by id. Cannot be undone — confirm with user first.",
      schema: z.object({ id: z.string() }),
      annotations: { destructiveHint: true },
      run: async (args) => { await client().deletePost(args.id); return { deleted: true, id: args.id }; },
    }),

  ];
}
