import { z } from "zod";
import { scriptInfo, scriptSchema, type ScriptInfo } from "./format.ts";

// A production is one show's prompt book: its script, and later its cues,
// notes and link to cuemute. It is stored as one JSON document.

export const productionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string(),
  script: scriptSchema.nullable().default(null),
});

export type Production = z.infer<typeof productionSchema>;

// throws a ZodError describing what is wrong with the document
export function parseProduction(data: unknown): Production {
  return productionSchema.parse(data);
}

export function createProduction(name: string, id: string = crypto.randomUUID()): Production {
  return { schemaVersion: 1, id, name: name.trim() || "Untitled production", script: null };
}

// what screens are sent on every change: the production without its script's
// text, which is large and changes rarely
export interface ProductionView {
  id: string;
  name: string;
  script: ScriptInfo | null;
}

export const productionView = (p: Production): ProductionView => ({
  id: p.id,
  name: p.name,
  script: p.script ? scriptInfo(p.script) : null,
});

// one production in the library's list
export interface ProductionSummary {
  id: string;
  name: string;
  modified: string; // ISO time
  script: string | null; // the script's file name
}
