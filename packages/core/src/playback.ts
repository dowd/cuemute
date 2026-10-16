import type { Scene } from "./types.ts";

// Where the operator is in the cue list. Held as scene ids, not indexes, so
// inserting, deleting or moving scenes mid-show doesn't shift the cursor.
export interface Cursor {
  current: string | null; // last scene fired
  next: string | null; // scene GO will fire; null at the end of the list
}

export const initialCursor: Cursor = { current: null, next: null };

export interface Step {
  cursor: Cursor;
  fire: Scene | null;
}

function indexOf(scenes: readonly Scene[], id: string | null): number {
  return id === null ? -1 : scenes.findIndex((s) => s.id === id);
}

function idAt(scenes: readonly Scene[], index: number): string | null {
  return scenes[index]?.id ?? null;
}

// Repairs a cursor after the scene list changed: a deleted current scene is
// forgotten, and a deleted or missing next scene becomes the one after current
// (the first scene when nothing has fired yet).
export function normalizeCursor(scenes: readonly Scene[], cursor: Cursor): Cursor {
  const current = indexOf(scenes, cursor.current) >= 0 ? cursor.current : null;
  if (indexOf(scenes, cursor.next) >= 0) return { current, next: cursor.next };
  return { current, next: idAt(scenes, indexOf(scenes, current) + 1) };
}

export function go(scenes: readonly Scene[], cursor: Cursor): Step {
  const c = normalizeCursor(scenes, cursor);
  const i = indexOf(scenes, c.next);
  const scene = scenes[i];
  if (!scene) return { cursor: c, fire: null };
  return { cursor: { current: scene.id, next: idAt(scenes, i + 1) }, fire: scene };
}

// Moves the next-scene pointer back one place. Sends nothing.
export function back(scenes: readonly Scene[], cursor: Cursor): Cursor {
  const c = normalizeCursor(scenes, cursor);
  const i = c.next === null ? scenes.length : indexOf(scenes, c.next);
  return { current: c.current, next: idAt(scenes, Math.max(0, i - 1)) };
}

// Moves the next-scene pointer on one place, skipping a scene without firing
// it. Stops at the last scene. Sends nothing.
export function forward(scenes: readonly Scene[], cursor: Cursor): Cursor {
  const c = normalizeCursor(scenes, cursor);
  if (c.next === null) return c;
  const i = indexOf(scenes, c.next);
  return { current: c.current, next: idAt(scenes, Math.min(scenes.length - 1, i + 1)) };
}

// Makes the scene with this id the next one, without firing anything. Returns
// null if there is no such scene.
export function setNext(scenes: readonly Scene[], cursor: Cursor, id: string): Cursor | null {
  if (indexOf(scenes, id) < 0) return null;
  return { current: normalizeCursor(scenes, cursor).current, next: id };
}

// Fires the scene with this id and continues from the one after it.
export function jump(scenes: readonly Scene[], id: string): Step {
  const i = indexOf(scenes, id);
  const scene = scenes[i];
  if (!scene) return { cursor: normalizeCursor(scenes, initialCursor), fire: null };
  return { cursor: { current: scene.id, next: idAt(scenes, i + 1) }, fire: scene };
}
