import { z } from "zod";

export type Loose = Record<string, unknown>;

export interface ToolDef<S extends z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  annotations?: { readOnlyHint?: true; destructiveHint?: true };
  run: (args: z.infer<S>) => Promise<unknown>;
}

export function t<S extends z.ZodTypeAny>(def: ToolDef<S>): ToolDef<S> { return def; }

export const idSchema = z.object({ id: z.string() });

export const listSchema = z.object({
  filter: z.string().optional(),
  page: z.number().optional(),
  limit: z.number().optional(),
  order: z.string().optional(),
  include: z.string().optional(),
  fields: z.string().optional(),
}).strict();

export const contentSchema = z.object({
  lexical: z.string().optional().describe("Ghost Lexical editor JSON (v6+). Mutually exclusive with mobiledoc/html."),
  mobiledoc: z.string().optional().describe("Mobiledoc JSON string. Mutually exclusive with lexical/html."),
  html: z.string().optional().describe("HTML body. Mutually exclusive with lexical/mobiledoc/content."),
  content: z.string().optional().describe("Markdown or plain text body. Mutually exclusive with lexical/mobiledoc/html."),
});
