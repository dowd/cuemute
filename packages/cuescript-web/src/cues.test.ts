import { describe, expect, it } from "vitest";
import { defaultDepartments, type Cue, type Note } from "@cuemute/script";
import { cueLabel, filtered, isSelected, nextNumber, showAll } from "./cues.ts";

const at = { paragraph: "p1", word: 0, quote: "Hello" };
const mute: Cue = { id: "m", kind: "mute", scene: "s12", number: "012", name: "Capucine", at };
const lx: Cue = { id: "c1", kind: "cue", department: "lx", number: "14", label: "Blackout", notes: "", at };
const note: Note = { id: "n1", text: "Mic 3", at };
const production = { departments: defaultDepartments(), cues: [mute, lx], notes: [note] };

describe("cue helpers", () => {
  it("label cues as the margin shows them", () => {
    expect(cueLabel(mute, production.departments)).toBe("012");
    expect(cueLabel(lx, production.departments)).toBe("LX 14");
  });

  it("number a new cue one on from the department's last whole number", () => {
    expect(nextNumber([])).toBe("1");
    expect(nextNumber(["1", "2", "14.5"])).toBe("15");
    expect(nextNumber(["3", "A"])).toBe("4");
  });

  it("tell a selected scene from a selected cue or note", () => {
    expect(isSelected({ kind: "scene", id: "s12" }, mute)).toBe(true);
    expect(isSelected({ kind: "cue", id: "m" }, mute)).toBe(false);
    expect(isSelected({ kind: "cue", id: "c1" }, lx)).toBe(true);
    expect(isSelected({ kind: "note", id: "n1" }, note)).toBe(true);
    expect(isSelected({ kind: "cue", id: "n1" }, note)).toBe(false);
  });
});

describe("filtered", () => {
  it("shows everything by default", () => {
    expect(filtered(production, showAll)).toEqual(production);
  });

  it("hides the departments and notes a screen turns off", () => {
    expect(filtered(production, { hidden: ["lx"], notes: true }).cues).toEqual([mute]);
    expect(filtered(production, { hidden: ["mutes"], notes: false })).toMatchObject({ cues: [lx], notes: [] });
  });
});
