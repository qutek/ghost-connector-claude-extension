import { z } from "zod";
import { GhostClient } from "../ghost.js";
import { summarize, type SummaryItem } from "../lexical.js";
import { t, idSchema, type Loose } from "./_shared.js";

export function membersTools(client: () => GhostClient) {
  return [
    t({
      name: "ghost_list_members",
      description: "List members. Filter e.g. 'status:paid'.",
      schema: z.object({
        filter: z.string().optional(),
        limit: z.number().optional(),
        page: z.number().optional(),
        order: z.string().optional(),
      }),
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().listMembers(args)) as { members?: SummaryItem[] } | null;
        return summarize("members", r?.members ?? []);
      },
    }),
    t({
      name: "ghost_get_member",
      description: "Fetch a single member by id.",
      schema: idSchema,
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().getMember(args.id)) as { members?: unknown[] } | null;
        return r?.members?.[0] ?? null;
      },
    }),
    t({
      name: "ghost_create_member",
      description: "Create a member. email required.",
      schema: z.object({
        email: z.string(),
        name: z.string().optional(),
        note: z.string().optional(),
        subscribed: z.boolean().default(true),
        newsletters: z.array(z.string()).optional().describe("Newsletter ids to subscribe to."),
        labels: z.array(z.string()).optional().describe("Free-form label names."),
      }),
      run: async (args) => {
        const doc: Loose = { email: args.email };
        for (const k of ["name", "note", "subscribed"] as const) if (args[k] !== undefined) doc[k] = args[k];
        if (args.newsletters?.length) doc.newsletters = args.newsletters.map((nid) => ({ id: nid }));
        if (args.labels?.length) doc.labels = args.labels.map((n) => ({ name: n }));
        const r = (await client().createMember(doc)) as { members?: unknown[] } | null;
        return r?.members?.[0];
      },
    }),
    t({
      name: "ghost_update_member",
      description: "Update a member by id.",
      schema: z.object({
        id: z.string(),
        email: z.string().optional(),
        name: z.string().optional(),
        note: z.string().optional(),
        subscribed: z.boolean().optional(),
        newsletters: z.array(z.string()).optional(),
        labels: z.array(z.string()).optional(),
      }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const { id, ...rest } = args;
        const doc: Loose = {};
        for (const k of ["email", "name", "note", "subscribed"] as const) if (rest[k] !== undefined) doc[k] = rest[k];
        if (rest.newsletters?.length) doc.newsletters = rest.newsletters.map((nid) => ({ id: nid }));
        if (rest.labels?.length) doc.labels = rest.labels.map((n) => ({ name: n }));
        const r = (await client().updateMember(id, doc)) as { members?: unknown[] } | null;
        return r?.members?.[0];
      },
    }),
    t({
      name: "ghost_delete_member",
      description: "Permanently delete a member by id. Confirm first.",
      schema: idSchema,
      annotations: { destructiveHint: true },
      run: async (args) => { await client().deleteMember(args.id); return { deleted: true, id: args.id }; },
    }),
  ];
}
