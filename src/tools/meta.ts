import { z } from "zod";
import { GhostClient } from "../ghost.js";
import { t, type Loose } from "./_shared.js";

export function metaTools(client: () => GhostClient, blogUrl: string | undefined) {
  return [
    t({
      name: "ghost_whoami",
      description: "Sanity check: fetch site settings + verify credentials. Call this first after install to confirm configuration is correct.",
      schema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
      run: async () => {
        const s = ((await client().getSettings()) as { settings?: Loose } | null)?.settings || {};
        return {
          blog_url: blogUrl,
          site_title: s.title,
          site_description: s.description,
          timezone: s.timezone,
          version: s.version,
          credentials_ok: true,
        };
      },
    }),
  ];
}
