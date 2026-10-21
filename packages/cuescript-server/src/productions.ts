import { EventEmitter } from "node:events";
import { createProduction, parseProduction, type Production, type Script } from "@cuemute/script";
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

  setScript(id: string, script: Script): void {
    this.#save({ ...this.get(id), script });
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
