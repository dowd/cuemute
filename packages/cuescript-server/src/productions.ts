import { EventEmitter } from "node:events";
import {
  createProduction,
  MUTES,
  paragraphWords,
  parseProduction,
  order,
  placeInOrder,
  quoteAt,
  type Anchor,
  type Cue,
  type Department,
  type DeptCue,
  type Link,
  type LinkedScene,
  type MuteCue,
  type Note,
  type Position,
  type Production,
  type Script,
} from "@cuemute/script";
import type { ProductionStore } from "./store.ts";

// An error the HTTP layer turns into a response with this status.
export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The single source of truth for every production. Each change is one small
// operation that saves straight away and emits "change" with the production's
// id, or "deleted". Productions stay in memory once read.
export class Productions extends EventEmitter<{ change: [id: string]; deleted: [id: string] }> {
  readonly #store: ProductionStore;
  readonly #open = new Map<string, Production>();

  constructor(store: ProductionStore) {
    super();
    this.#store = store;
  }

  list() {
    return this.#store.list();
  }

  get(id: string): Production {
    let p = this.#open.get(id);
    if (!p) {
      let loaded: Production | null;
      try {
        loaded = this.#store.load(id);
      } catch {
        throw new HttpError(422, "That production's file is damaged");
      }
      if (!loaded) throw new HttpError(404, "No such production");
      p = loaded;
      this.#open.set(id, p);
    }
    return p;
  }

  create(name: string): Production {
    const p = createProduction(name);
    this.#save(p);
    return p;
  }

  // a production file from elsewhere, such as an export from another copy of
  // cuescript. It gets a new id, so it never replaces one already here.
  import(data: unknown): Production {
    let p: Production;
    try {
      p = parseProduction(data);
    } catch {
      throw new HttpError(400, "That file isn't a cuescript production, or it is damaged");
    }
    const copy = { ...p, id: createProduction(p.name).id };
    this.#save(copy);
    return copy;
  }

  rename(id: string, name: string): void {
    const p = this.get(id);
    this.#save({ ...p, name: name.trim() || p.name });
  }

  // Swaps in a script, or a new version of it. Each cue and note is found
  // again by its quote. A mute cue that can't be is dropped, and its scene
  // shows as not placed; a department cue or note stays, unplaced, to place by
  // hand. Returns how many cues were placed.
  setScript(id: string, script: Script): number {
    const p = this.get(id);
    // everything placed, in script order, so order settles repeated quotes
    type Item = { at: Anchor; near: Position | null; index: number; cue?: Cue; note?: Note };
    const items: Item[] = [
      ...p.cues.flatMap((cue, index) => (cue.at ? [{ at: cue.at, cue, index }] : [])),
      ...p.notes.flatMap((note, index) => (note.at ? [{ at: note.at, note, index }] : [])),
    ].map((x) => ({ ...x, near: p.script ? positionOf(p.script, x.at) : null }));
    items.sort((a, b) => (a.near && b.near ? order(a.near) - order(b.near) : 0));
    const found = placeInOrder(
      items.map((x) => ({ quotes: [x.at.quote], near: x.near ?? undefined })),
      script.paragraphs,
    );
    const cueAt = new Map<Cue, Anchor | null>();
    const noteAt = new Map<Note, Anchor | null>();
    items.forEach((x, i) => {
      const at = found[i] ? anchorAt(script, found[i]!) : null;
      if (x.cue) cueAt.set(x.cue, at);
      if (x.note) noteAt.set(x.note, at);
    });
    const cues = p.cues.flatMap((c): Cue[] => {
      const at = cueAt.has(c) ? cueAt.get(c)! : c.at;
      if (c.kind === "mute") return at ? [{ ...c, at }] : [];
      return [{ ...c, at }];
    });
    const notes = p.notes.map((n) => ({ ...n, at: noteAt.has(n) ? noteAt.get(n)! : n.at }));
    this.#save({ ...p, script, cues, notes });
    return cues.filter((c) => c.at).length;
  }

  setLink(id: string, link: Link | null): void {
    this.#save({ ...this.get(id), link });
  }

  // Replaces the department list. The mutes department stays, and a
  // department that still has cues can't go.
  setDepartments(id: string, departments: Department[]): void {
    const p = this.get(id);
    const ids = new Set(departments.map((d) => d.id));
    if (ids.size !== departments.length) throw new HttpError(400, "Two departments have the same id");
    if (!ids.has(MUTES)) throw new HttpError(400, "The mutes department can't be removed");
    for (const d of p.departments) {
      const count = p.cues.filter((c) => c.kind === "cue" && c.department === d.id).length;
      if (!ids.has(d.id) && count > 0) {
        throw new HttpError(409, `${d.name} has ${count} cue${count === 1 ? "" : "s"}. Delete them first.`);
      }
    }
    this.#save({ ...p, departments });
  }

  // Places a cuemute scene at a word, or moves it there if it is placed.
  placeScene(id: string, scene: LinkedScene, at: { paragraph: string; word: number }): MuteCue {
    const p = this.get(id);
    const script = this.#script(p);
    const position = this.#position(script, at);
    const old = p.cues.find((c) => c.kind === "mute" && c.scene === scene.id);
    const cue: MuteCue = {
      id: old?.id ?? crypto.randomUUID(),
      kind: "mute",
      scene: scene.id,
      number: scene.number,
      name: scene.name,
      at: anchorAt(script, position),
    };
    this.#save({ ...p, cues: [...p.cues.filter((c) => c !== old), cue] });
    return cue;
  }

  addCue(id: string, fields: Omit<DeptCue, "id" | "kind" | "at">, at: { paragraph: string; word: number }): DeptCue {
    const p = this.get(id);
    this.#requireDepartment(p, fields.department);
    const script = this.#script(p);
    const cue: DeptCue = { id: crypto.randomUUID(), kind: "cue", ...fields, at: anchorAt(script, this.#position(script, at)) };
    this.#save({ ...p, cues: [...p.cues, cue] });
    return cue;
  }

  // changes a department cue's fields, and moves it if at is given
  updateCue(
    id: string,
    cueId: string,
    patch: Partial<Omit<DeptCue, "id" | "kind" | "at">>,
    at?: { paragraph: string; word: number },
  ): void {
    const p = this.get(id);
    const old = p.cues.find((c) => c.id === cueId);
    if (!old) throw new HttpError(404, "No such cue");
    if (old.kind !== "cue") throw new HttpError(409, "Change a mute cue's scene in cuemute");
    if (patch.department !== undefined) this.#requireDepartment(p, patch.department);
    const script = at ? this.#script(p) : null;
    const cue: DeptCue = { ...old, ...patch, ...(script && at ? { at: anchorAt(script, this.#position(script, at)) } : {}) };
    this.#save({ ...p, cues: p.cues.map((c) => (c === old ? cue : c)) });
  }

  removeCue(id: string, cueId: string): void {
    const p = this.get(id);
    if (!p.cues.some((c) => c.id === cueId)) throw new HttpError(404, "No such cue");
    this.#save({ ...p, cues: p.cues.filter((c) => c.id !== cueId) });
  }

  addNote(id: string, text: string, at: { paragraph: string; word: number }): Note {
    const p = this.get(id);
    const script = this.#script(p);
    const note: Note = { id: crypto.randomUUID(), text, at: anchorAt(script, this.#position(script, at)) };
    this.#save({ ...p, notes: [...p.notes, note] });
    return note;
  }

  // changes a note's text, and moves it if at is given
  updateNote(id: string, noteId: string, text: string | undefined, at?: { paragraph: string; word: number }): void {
    const p = this.get(id);
    const old = p.notes.find((n) => n.id === noteId);
    if (!old) throw new HttpError(404, "No such note");
    const script = at ? this.#script(p) : null;
    const note: Note = {
      ...old,
      ...(text !== undefined ? { text } : {}),
      ...(script && at ? { at: anchorAt(script, this.#position(script, at)) } : {}),
    };
    this.#save({ ...p, notes: p.notes.map((n) => (n === old ? note : n)) });
  }

  removeNote(id: string, noteId: string): void {
    const p = this.get(id);
    if (!p.notes.some((n) => n.id === noteId)) throw new HttpError(404, "No such note");
    this.#save({ ...p, notes: p.notes.filter((n) => n.id !== noteId) });
  }

  // Places each cuemute scene that isn't placed yet by its Line / cue, keeping
  // to cuemute's order. Returns how many it placed.
  autoPlace(id: string, scenes: readonly LinkedScene[]): number {
    const p = this.get(id);
    if (!p.script) return 0;
    const script = p.script;
    const cueOf = muteCues(p);
    const found = placeInOrder(
      scenes.map((s) => {
        const cue = cueOf.get(s.id);
        return { at: cue ? positionOf(script, cue.at) : null, quotes: cue ? [] : [s.lineRef] };
      }),
      script.paragraphs,
    );
    const added: MuteCue[] = [];
    scenes.forEach((s, i) => {
      const at = found[i];
      if (!at || cueOf.has(s.id)) return;
      added.push({ id: crypto.randomUUID(), kind: "mute", scene: s.id, number: s.number, name: s.name, at: anchorAt(script, at) });
    });
    if (added.length > 0) this.#save({ ...p, cues: [...p.cues, ...added] });
    return added.length;
  }

  // keeps the copies of scene numbers and names in step with cuemute
  syncScenes(id: string, scenes: readonly LinkedScene[]): void {
    const p = this.get(id);
    const byId = new Map(scenes.map((s) => [s.id, s]));
    let changed = false;
    const cues = p.cues.map((c) => {
      const s = c.kind === "mute" ? byId.get(c.scene) : undefined;
      if (c.kind !== "mute" || !s || (s.number === c.number && s.name === c.name)) return c;
      changed = true;
      return { ...c, number: s.number, name: s.name };
    });
    if (changed) this.#save({ ...p, cues });
  }

  // where each placed cuemute scene is, by scene id
  scenePositions(id: string): Map<string, Position> {
    const p = this.get(id);
    const out = new Map<string, Position>();
    if (!p.script) return out;
    for (const cue of muteCues(p).values()) {
      const at = positionOf(p.script, cue.at);
      if (at) out.set(cue.scene, at);
    }
    return out;
  }

  // the script position of a paragraph id and word, checked
  position(id: string, at: { paragraph: string; word: number }): Position {
    return this.#position(this.#script(this.get(id)), at);
  }

  #script(p: Production): Script {
    if (!p.script) throw new HttpError(409, "Import a script first");
    return p.script;
  }

  #position(script: Script, at: { paragraph: string; word: number }): Position {
    const index = script.paragraphs.findIndex((x) => x.id === at.paragraph);
    const para = script.paragraphs[index];
    if (!para || at.word < 0 || at.word >= paragraphWords(para).length) {
      throw new HttpError(404, "No such word in the script");
    }
    return { index, word: at.word };
  }

  #requireDepartment(p: Production, department: string): void {
    if (department === MUTES) throw new HttpError(400, "Mute cues come from cuemute's scenes");
    if (!p.departments.some((d) => d.id === department)) throw new HttpError(404, "No such department");
  }

  delete(id: string): void {
    this.get(id);
    this.#store.delete(id);
    this.#open.delete(id);
    this.emit("deleted", id);
  }

  #save(p: Production): void {
    this.#store.save(p);
    this.#open.set(p.id, p);
    this.emit("change", p.id);
  }
}

const muteCues = (p: Production) =>
  new Map(p.cues.flatMap((c) => (c.kind === "mute" ? [[c.scene, c] as const] : [])));

// where an anchor is in a script, or null if its paragraph isn't in it
function positionOf(script: Script, at: Anchor): Position | null {
  const index = script.paragraphs.findIndex((x) => x.id === at.paragraph);
  return index < 0 ? null : { index, word: at.word };
}

function anchorAt(script: Script, at: Position): Anchor {
  const para = script.paragraphs[at.index]!;
  return { paragraph: para.id, word: at.word, quote: quoteAt(para, at.word) };
}
