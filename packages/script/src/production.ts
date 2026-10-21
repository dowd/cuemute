import { z } from "zod";
import { scriptInfo, scriptSchema, type ScriptInfo } from "./format.ts";

// A production is one show's prompt book: its script, its cues, and its link
// to cuemute. It is stored as one JSON document.

// Where a cue sits: a paragraph by its id, a word in it by its number, and
// the words that end at it, which find it again in a new script version.
export const anchorSchema = z.object({
  paragraph: z.string().min(1),
  word: z.number().int().min(0),
  quote: z.string(),
});

// A mute cue is a cuemute scene, placed in the script. Its number and name
// are copies, kept up to date while cuemute is linked, for when it isn't.
export const cueSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("mute"),
  scene: z.string().min(1), // the cuemute scene id
  number: z.string(),
  name: z.string(),
  at: anchorSchema,
});

// which cuemute, and which of its shows, this production goes with
export const linkSchema = z.object({
  url: z.string().url(),
  show: z.string(), // cuemute's show file name
});

export const productionSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  name: z.string(),
  script: scriptSchema.nullable().default(null),
  link: linkSchema.nullable().default(null),
  cues: z.array(cueSchema).default([]),
});

export type Anchor = z.infer<typeof anchorSchema>;
export type Cue = z.infer<typeof cueSchema>;
export type Link = z.infer<typeof linkSchema>;
export type Production = z.infer<typeof productionSchema>;

// throws a ZodError describing what is wrong with the document
export function parseProduction(data: unknown): Production {
  return productionSchema.parse(data);
}

export function createProduction(name: string, id: string = crypto.randomUUID()): Production {
  return { schemaVersion: 1, id, name: name.trim() || "Untitled production", script: null, link: null, cues: [] };
}

// what screens are sent on every change: the production without its script's
// text, which is large and changes rarely
export interface ProductionView {
  id: string;
  name: string;
  script: ScriptInfo | null;
  link: Link | null;
  cues: Cue[];
}

export const productionView = (p: Production): ProductionView => ({
  id: p.id,
  name: p.name,
  script: p.script ? scriptInfo(p.script) : null,
  link: p.link,
  cues: p.cues,
});

// one production in the library's list
export interface ProductionSummary {
  id: string;
  name: string;
  modified: string; // ISO time
  script: string | null; // the script's file name
}

// a cuemute scene, as cuescript needs it
export interface LinkedScene {
  id: string;
  number: string;
  name: string;
  lineRef: string;
}

// What cuescript knows of the linked cuemute right now. Screens get it apart
// from the production, as it changes with every GO.
export interface LinkState {
  status: "off" | "connecting" | "connected" | "unreachable" | "other-show";
  // for the operator, when the status isn't "connected"
  message: string;
  mode: "show" | "edit" | null;
  current: string | null;
  next: string | null;
  // cuemute's scenes in its order; empty unless connected
  scenes: LinkedScene[];
}

export const linkOff: LinkState = { status: "off", message: "", mode: null, current: null, next: null, scenes: [] };
