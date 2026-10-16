import { existsSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { createShow, parseShow, type Show } from "@cuemute/core";
import { EngineError, type Engine } from "./engine.ts";
import { ShowStore } from "./store.ts";

export interface ShowEntry {
  file: string;
  name: string;
  scenes: number;
  modified: string; // ISO time
  error?: string; // set if the file can't be read as a show
}

// remembers the last show opened, so cuemute reopens it at start
const LAST = ".last-show";

// A folder of show files, one JSON file per show. One show is open at a time.
// A file is named by a show's name when it is made, and keeps that name when
// the show is renamed. Each file's .bak is the version before its last save.
export class ShowLibrary {
  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  // the show to open at start: the one asked for, else the last one opened,
  // else the most recently changed, else a new show.json
  startPath(asked: string | null): string {
    if (asked) return asked;
    try {
      const last = readFileSync(join(this.dir, LAST), "utf8").trim();
      if (this.#valid(last) && existsSync(join(this.dir, last))) return join(this.dir, last);
    } catch {
      // nothing opened yet
    }
    const newest = this.list()
      .filter((s) => !s.error)
      .sort((a, b) => b.modified.localeCompare(a.modified))[0];
    return join(this.dir, newest?.file ?? "show.json");
  }

  // the file name of a path in this library, or null if it is elsewhere
  fileOf(path: string): string | null {
    return resolve(dirname(path)) === resolve(this.dir) ? basename(path) : null;
  }

  remember(path: string): void {
    const file = this.fileOf(path);
    if (!file) return;
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, LAST), `${file}\n`);
  }

  list(): ShowEntry[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir)
      .filter((f) => this.#valid(f))
      .map((file) => {
        const path = join(this.dir, file);
        const modified = statSync(path).mtime.toISOString();
        try {
          const show = parseShow(JSON.parse(readFileSync(path, "utf8")));
          return { file, name: show.name, scenes: show.scenes.length, modified };
        } catch {
          return { file, name: file, scenes: 0, modified, error: "Not a cuemute show, or damaged" };
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file));
  }

  read(file: string): Show {
    const path = this.#path(file);
    try {
      return parseShow(JSON.parse(readFileSync(path, "utf8")));
    } catch {
      throw new EngineError(422, `${file} isn't a cuemute show, or it is damaged`);
    }
  }

  open(engine: Engine, file: string): void {
    const show = this.read(file);
    this.#swap(engine, file, show);
  }

  // a new, empty show for the same desk as the open one
  create(engine: Engine, name: string): string {
    this.#requireEdit(engine);
    const show = { ...createShow(name.trim() || "Untitled show"), console: engine.snapshot().show.console };
    const file = this.#write(show);
    this.#swap(engine, file, show);
    return file;
  }

  // a copy of a show under a new name, which then opens: "save as"
  duplicate(engine: Engine, from: string, name: string): string {
    this.#requireEdit(engine);
    const show = { ...this.read(from), name: name.trim() || "Untitled show" };
    const file = this.#write(show);
    this.#swap(engine, file, show);
    return file;
  }

  // a show file from elsewhere, added to the library and opened
  import(engine: Engine, data: unknown): string {
    this.#requireEdit(engine);
    let show: Show;
    try {
      show = parseShow(data);
    } catch {
      throw new EngineError(400, "That file isn't a cuemute show, or it is damaged");
    }
    const file = this.#write(show);
    this.#swap(engine, file, show);
    return file;
  }

  delete(engine: Engine, file: string): void {
    this.#requireEdit(engine);
    const path = this.#path(file);
    if (engine.snapshot().file === file) throw new EngineError(409, "Open another show before deleting this one");
    rmSync(path);
    rmSync(`${path}.bak`, { force: true });
  }

  #swap(engine: Engine, file: string, show: Show): void {
    const store = new ShowStore(join(this.dir, file));
    engine.openShow(show, (s) => store.save(s), file);
    this.remember(store.path);
  }

  // writes a show to a new file named after it: "Into the Woods" is into-the-woods.json
  #write(show: Show): string {
    const slug =
      show.name
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "show";
    let file = `${slug}.json`;
    for (let n = 2; existsSync(join(this.dir, file)); n++) file = `${slug}-${n}.json`;
    new ShowStore(join(this.dir, file)).save(show);
    return file;
  }

  #path(file: string): string {
    if (!this.#valid(file)) throw new EngineError(400, "Not a show file name");
    const path = join(this.dir, file);
    if (!existsSync(path)) throw new EngineError(404, "No such show");
    return path;
  }

  // a plain file name in this folder: no paths, no hidden files
  #valid(file: string): boolean {
    return file.endsWith(".json") && !file.startsWith(".") && basename(file) === file && !file.includes("\\");
  }

  #requireEdit(engine: Engine): void {
    if (engine.mode !== "edit") throw new EngineError(409, "Switch to Edit mode to change the show");
  }
}
