import { EventEmitter } from "node:events";
import {
  createProduction,
  paragraphWords,
  parseProduction,
  placeInOrder,
  quoteAt,
  type Cue,
  type Link,
  type LinkedScene,
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

  // Swaps in a script, or a new version of it. Each cue is found again by its
  // quote; one that can't be is dropped, and its scene shows as not placed.
  // Returns how many cues were kept.
  setScript(id: string, script: Script): number {
    const p = this.get(id);
    const placed = p.cues
      .map((cue) => ({ cue, near: p.script ? positionOf(p.script, cue) : null }))
      .sort((a, b) => (a.near && b.near ? a.near.index - b.near.index || a.near.word - b.near.word : 0));
    const found = placeInOrder(
      placed.map(({ cue, near }) => ({ quotes: [cue.at.quote], near: near ?? undefined })),
      script.paragraphs,
    );
    const cues = placed.flatMap(({ cue }, i) => {
      const at = found[i];
      return at ? [{ ...cue, at: anchorAt(script, at) }] : [];
    });
    this.#save({ ...p, script, cues });
    return cues.length;
  }

  setLink(id: string, link: Link | null): void {
    this.#save({ ...this.get(id), link });
  }

  // Places a cuemute scene at a word, or moves it there if it is placed.
  placeScene(id: string, scene: LinkedScene, at: { paragraph: string; word: number }): Cue {
    const p = this.get(id);
    const script = this.#script(p);
    const position = this.#position(script, at);
    const old = p.cues.find((c) => c.kind === "mute" && c.scene === scene.id);
    const cue: Cue = {
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

  removeCue(id: string, cueId: string): void {
    const p = this.get(id);
    if (!p.cues.some((c) => c.id === cueId)) throw new HttpError(404, "No such cue");
    this.#save({ ...p, cues: p.cues.filter((c) => c.id !== cueId) });
  }

  // Places each cuemute scene that isn't placed yet by its Line / cue, keeping
  // to cuemute's order. Returns how many it placed.
  autoPlace(id: string, scenes: readonly LinkedScene[]): number {
    const p = this.get(id);
    if (!p.script) return 0;
    const script = p.script;
    const cueOf = new Map(p.cues.map((c) => [c.scene, c]));
    const found = placeInOrder(
      scenes.map((s) => {
        const cue = cueOf.get(s.id);
        return { at: cue ? positionOf(script, cue) : null, quotes: cue ? [] : [s.lineRef] };
      }),
      script.paragraphs,
    );
    const added: Cue[] = [];
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
      const s = byId.get(c.scene);
      if (!s || (s.number === c.number && s.name === c.name)) return c;
      changed = true;
      return { ...c, number: s.number, name: s.name };
    });
    if (changed) this.#save({ ...p, cues });
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

// where a cue is in a script, or null if its paragraph isn't in it
function positionOf(script: Script, cue: Cue): Position | null {
  const index = script.paragraphs.findIndex((x) => x.id === cue.at.paragraph);
  return index < 0 ? null : { index, word: cue.at.word };
}

function anchorAt(script: Script, at: Position) {
  const para = script.paragraphs[at.index]!;
  return { paragraph: para.id, word: at.word, quote: quoteAt(para, at.word) };
}
