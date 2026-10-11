import { z } from "zod";
import type { Channel, Scene, Show } from "./types.ts";

const targetSchema = z.object({
  kind: z.literal("input"),
  number: z.number().int().min(1).max(128),
});

const changeSchema = z.object({ target: targetSchema, muted: z.boolean() });

export const sceneSchema = z.object({
  id: z.string().min(1),
  number: z.string(),
  name: z.string(),
  lineRef: z.string(),
  notes: z.string(),
  colour: z.string(),
  changes: z.array(changeSchema),
});

export const channelSchema = z.object({
  number: z.number().int().min(1).max(128),
  name: z.string(),
});

export const consoleSettingsSchema = z.object({
  type: z.enum(["sim", "qu", "sq"]),
  host: z.string(),
  midiChannel: z.number().int().min(1).max(16),
});

export const showSchema = z.object({
  schemaVersion: z.literal(1),
  name: z.string(),
  channels: z.array(channelSchema),
  scenes: z.array(sceneSchema),
  console: consoleSettingsSchema,
});

// editable scene fields, as accepted from the UI
export const scenePatchSchema = sceneSchema.omit({ id: true }).partial();
export type ScenePatch = z.infer<typeof scenePatchSchema>;

// throws a ZodError describing what is wrong with the file
export function parseShow(data: unknown): Show {
  return showSchema.parse(data);
}

export function createShow(name = "Untitled show"): Show {
  return {
    schemaVersion: 1,
    name,
    channels: [],
    scenes: [],
    console: { type: "sim", host: "", midiChannel: 1 },
  };
}

export function newScene(fields: ScenePatch = {}, id: string = crypto.randomUUID()): Scene {
  return {
    id,
    number: "",
    name: "",
    lineRef: "",
    notes: "",
    colour: "",
    changes: [],
    ...fields,
  };
}

// Inserts after the scene with afterId, at the top when afterId is null, and at
// the end when afterId no longer exists.
export function insertScene(show: Show, afterId: string | null, scene: Scene): Show {
  const scenes = [...show.scenes];
  let at = 0;
  if (afterId !== null) {
    const i = scenes.findIndex((s) => s.id === afterId);
    at = i < 0 ? scenes.length : i + 1;
  }
  scenes.splice(at, 0, scene);
  return { ...show, scenes };
}

export function updateScene(show: Show, id: string, patch: ScenePatch): Show {
  return { ...show, scenes: show.scenes.map((s) => (s.id === id ? { ...s, ...patch } : s)) };
}

export function deleteScene(show: Show, id: string): Show {
  return { ...show, scenes: show.scenes.filter((s) => s.id !== id) };
}

export function moveScene(show: Show, id: string, toIndex: number): Show {
  const from = show.scenes.findIndex((s) => s.id === id);
  const scene = show.scenes[from];
  if (!scene) return show;
  const scenes = show.scenes.filter((s) => s.id !== id);
  scenes.splice(Math.max(0, Math.min(toIndex, scenes.length)), 0, scene);
  return { ...show, scenes };
}

// Channels are kept sorted and unique by number.
export function setChannels(show: Show, channels: readonly Channel[]): Show {
  const byNumber = new Map(channels.map((c) => [c.number, c]));
  return { ...show, channels: [...byNumber.values()].sort((a, b) => a.number - b.number) };
}

// scene numbers used more than once, ignoring blanks
export function duplicateNumbers(scenes: readonly Scene[]): Set<string> {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const s of scenes) {
    const n = s.number.trim();
    if (!n) continue;
    if (seen.has(n)) dupes.add(n);
    seen.add(n);
  }
  return dupes;
}
