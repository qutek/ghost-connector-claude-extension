import { z } from "zod";
import { GhostClient } from "../ghost.js";
import { summarize, type SummaryItem } from "../lexical.js";
import { t, idSchema, type Loose } from "./_shared.js";

export function authorsTools(client: () => GhostClient) {
  return [
    t({
      name: "ghost_list_authors",
      description: "List staff users / authors.",
      schema: z.object({ filter: z.string().optional(), limit: z.number().optional(), page: z.number().optional() }),
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().listUsers(args)) as { users?: SummaryItem[] } | null;
        return summarize("authors", r?.users ?? []);
      },
    }),
    t({
      name: "ghost_get_author",
      description: "Fetch a single user by id.",
      schema: idSchema,
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().getUser(args.id)) as { users?: unknown[] } | null;
        return r?.users?.[0] ?? null;
      },
    }),
    t({
      name: "ghost_update_author",
      description: "Update own profile fields (name, slug, bio, website, location, facebook, twitter, profile_image, cover_image). Some fields only editable by Owner role.",
      schema: z.object({
        id: z.string(),
        name: z.string().optional(),
        slug: z.string().optional(),
        bio: z.string().optional(),
        website: z.string().optional(),
        location: z.string().optional(),
        facebook: z.string().optional(),
        twitter: z.string().optional(),
        profile_image: z.string().optional(),
        cover_image: z.string().optional(),
      }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const { id, ...rest } = args;
        const doc: Loose = {};
        for (const k of ["name", "slug", "bio", "website", "location", "facebook", "twitter", "profile_image", "cover_image"] as const) {
          if (rest[k] !== undefined) doc[k] = rest[k];
        }
        const r = (await client().updateUser(id, doc)) as { users?: unknown[] } | null;
        return r?.users?.[0];
      },
    }),
  ];
}
