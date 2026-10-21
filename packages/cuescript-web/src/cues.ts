import { MUTES, type Cue, type Department, type Note } from "@cuemute/script";

// What is selected for editing: a cuemute scene, a department cue, or a note.
export type Selection = { kind: "scene" | "cue" | "note"; id: string } | null;

export interface WordAt {
  paragraph: string;
  word: number;
}

export const departmentOf = (cue: Cue, departments: Department[]): Department | undefined =>
  departments.find((d) => d.id === (cue.kind === "mute" ? MUTES : cue.department));

// how a cue reads in the margin: "012" for a scene, "LX 14" for a department cue
export function cueLabel(cue: Cue, departments: Department[]): string {
  if (cue.kind === "mute") return cue.number || "–";
  const code = departmentOf(cue, departments)?.code;
  return [code, cue.number].filter(Boolean).join(" ") || "–";
}

export const cueTitle = (cue: Cue): string =>
  cue.kind === "mute" ? [cue.number, cue.name].filter(Boolean).join(" ") : [cue.number, cue.label].filter(Boolean).join(" ");

// whether a selection is this cue or note
export function isSelected(selection: Selection, item: Cue | Note): boolean {
  if (!selection) return false;
  if ("kind" in item && item.kind === "mute") return selection.kind === "scene" && selection.id === item.scene;
  return selection.id === item.id && selection.kind === ("kind" in item ? "cue" : "note");
}

// The number a new cue most likely takes: one more than the department's last
// whole-numbered cue before it in the script, or 1.
export function nextNumber(before: string[]): string {
  for (let i = before.length - 1; i >= 0; i--) {
    const n = Number.parseFloat(before[i]!);
    if (Number.isFinite(n)) return String(Math.floor(n) + 1);
  }
  return "1";
}

// What one screen shows: departments it hides (so a new one shows), and notes.
export interface Filter {
  hidden: string[];
  notes: boolean;
}

export const showAll: Filter = { hidden: [], notes: true };

// the cues and notes a screen shows, by its filter
export function filtered<T extends { cues: Cue[]; notes: Note[]; departments: Department[] }>(p: T, f: Filter): T {
  const shown = (c: Cue) => !f.hidden.includes(departmentOf(c, p.departments)?.id ?? "");
  return { ...p, cues: p.cues.filter(shown), notes: f.notes ? p.notes : [] };
}
