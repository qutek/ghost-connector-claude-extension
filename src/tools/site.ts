import { z } from "zod";
import { GhostClient } from "../ghost.js";
import { summarize, type SummaryItem } from "../lexical.js";
import { t, type Loose } from "./_shared.js";

export function siteTools(client: () => GhostClient) {
  return [
    // ---- TIERS ----
    t({
      name: "ghost_list_tiers",
      description: "List membership tiers (free/paid).",
      schema: z.object({ include: z.string().optional().describe("e.g. 'monthly_price,yearly_price,benefits'.") }),
      annotations: { readOnlyHint: true },
      run: async (args) => {
        const r = (await client().listTiers(args)) as { tiers?: SummaryItem[] } | null;
        return summarize("tiers", r?.tiers ?? []);
      },
    }),
    t({
      name: "ghost_update_tier",
      description: "Update a tier (name, description, visibility, etc.).",
      schema: z.object({
        id: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        visibility: z.enum(["public", "none", "internal"]).optional(),
        active: z.boolean().optional(),
      }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const { id, ...rest } = args;
        const doc: Loose = {};
        for (const k of ["name", "description", "visibility", "active"] as const) if (rest[k] !== undefined) doc[k] = rest[k];
        const r = (await client().updateTier(id, doc)) as { tiers?: unknown[] } | null;
        return r?.tiers?.[0];
      },
    }),

    // ---- NEWSLETTERS ----
    t({
      name: "ghost_list_newsletters",
      description: "List newsletters configured on the site.",
      schema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
      run: async () => {
        const r = (await client().listNewsletters()) as { newsletters?: SummaryItem[] } | null;
        return summarize("newsletters", r?.newsletters ?? []);
      },
    }),

    // ---- SETTINGS ----
    t({
      name: "ghost_get_settings",
      description: "Fetch site settings (title, description, logo, icon, navigation, timezone, etc.).",
      schema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
      run: async () => {
        const r = (await client().getSettings()) as { settings?: unknown } | null;
        return r?.settings ?? null;
      },
    }),
    t({
      name: "ghost_update_settings",
      description: "Update site settings. Pass array-style fields; each entry is {key,value}. Confirm with user — affects the live site.",
      schema: z.object({
        settings: z.array(z.object({
          key: z.string(),
          value: z.unknown().describe("Any JSON value (string, number, boolean, array, object)."),
        })),
      }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const r = (await client().updateSettings(args.settings)) as { settings?: unknown } | null;
        return r?.settings ?? null;
      },
    }),

    // ---- THEMES ----
    t({
      name: "ghost_list_themes",
      description: "List installed themes.",
      schema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
      run: async () => {
        const r = (await client().listThemes()) as { themes?: SummaryItem[] } | null;
        return summarize("themes", r?.themes ?? []);
      },
    }),
    t({
      name: "ghost_activate_theme",
      description: "Activate an installed theme by name. Changes the live site's appearance — confirm first.",
      schema: z.object({ name: z.string() }),
      annotations: { destructiveHint: true },
      run: async (args) => {
        const r = (await client().activateTheme(args.name)) as { themes?: unknown[] } | null;
        return r?.themes?.[0] ?? null;
      },
    }),
  ];
}
