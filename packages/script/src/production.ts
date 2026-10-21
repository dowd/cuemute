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

// A department whose cues show in the script, such as LX. The mutes
// department holds the cuemute scenes, and can't be removed.
export const departmentSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string(),
  code: z.string().max(8), // shown with each cue number, such as "LX"
  colour: z.string().regex(/^#[0-9a-f]{6}$/),
});

export const MUTES = "mutes";

export const defaultDepartments = (): Department[] => [
  { id: MUTES, name: "Sound (mutes)", code: "", colour: "#9aa1ab" },
  { id: "lx", name: "Lighting", code: "LX", colour: "#e6b84a" },
  { id: "sfx", name: "Sound effects", code: "SFX", colour: "#9b6bd6" },
  { id: "fly", name: "Flies", code: "FLY", colour: "#f08a4a" },
  { id: "sm", name: "Stage management", code: "SM", colour: "#e377c2" },
];

// A mute cue is a cuemute scene, placed in the script. Its number and name
// are copies, kept up to date while cuemute is linked, for when it isn't.
export const muteCueSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("mute"),
  scene: z.string().min(1), // the cuemute scene id
  number: z.string(),
  name: z.string(),
  at: anchorSchema,
});

// A cue for another department. cuescript shows it, and fires nothing. It is
// unplaced (at is null) when a new script version lost its words.
export const deptCueSchema = z.object({
  id: z.string().min(1),
  kind: z.literal("cue"),
  department: z.string().min(1),
  number: z.string(),
  label: z.string(),
  notes: z.string(),
  at: anchorSchema.nullable(),
});

export const cueSchema = z.discriminatedUnion("kind", [muteCueSchema, deptCueSchema]);

// a note on a line of the script; unplaced like a cue if its words are lost
export const noteSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  at: anchorSchema.nullable(),
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
  departments: z.array(departmentSchema).default(defaultDepartments),
  cues: z.array(cueSchema).default([]),
  notes: z.array(noteSchema).default([]),
});

export type Anchor = z.infer<typeof anchorSchema>;
export type Department = z.infer<typeof departmentSchema>;
export type MuteCue = z.infer<typeof muteCueSchema>;
export type DeptCue = z.infer<typeof deptCueSchema>;
export type Cue = z.infer<typeof cueSchema>;
export type Note = z.infer<typeof noteSchema>;
export type Link = z.infer<typeof linkSchema>;
export type Production = z.infer<typeof productionSchema>;

// throws a ZodError describing what is wrong with the document
export function parseProduction(data: unknown): Production {
  return productionSchema.parse(data);
}

export function createProduction(name: string, id: string = crypto.randomUUID()): Production {
  return {
    schemaVersion: 1,
    id,
    name: name.trim() || "Untitled production",
    script: null,
    link: null,
    departments: defaultDepartments(),
    cues: [],
    notes: [],
  };
}

// what screens are sent on every change: the production without its script's
// text, which is large and changes rarely
export interface ProductionView {
  id: string;
  name: string;
  script: ScriptInfo | null;
  link: Link | null;
  departments: Department[];
  cues: Cue[];
  notes: Note[];
}

export const productionView = (p: Production): ProductionView => ({
  id: p.id,
  name: p.name,
  script: p.script ? scriptInfo(p.script) : null,
  link: p.link,
  departments: p.departments,
  cues: p.cues,
  notes: p.notes,
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
