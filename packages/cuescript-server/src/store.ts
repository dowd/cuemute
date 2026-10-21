import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseProduction, type Production, type ProductionSummary } from "@cuemute/script";

// Where productions are kept. The folder is one way; a database can be another,
// for a host with no lasting disk. Everything else reaches storage through this.
export interface ProductionStore {
  list(): ProductionSummary[];
  // null if there is no such production; throws if it can't be read
  load(id: string): Production | null;
  save(production: Production): void;
  delete(id: string): void;
}

const ID = /^[a-z0-9-]{1,64}$/;

// One JSON file per production, named by its id. Each save keeps the previous
// version as <file>.bak and writes through a temp file, so a crash mid-save
// never leaves a half file.
export class FolderStore implements ProductionStore {
  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  list(): ProductionSummary[] {
    if (!existsSync(this.dir)) return [];
    const out: ProductionSummary[] = [];
    for (const file of readdirSync(this.dir)) {
      const id = file.slice(0, -".json".length);
      if (!file.endsWith(".json") || !ID.test(id)) continue;
      try {
        const p = this.load(id)!;
        const modified = statSync(this.#path(id)).mtime.toISOString();
        out.push({ id: p.id, name: p.name, modified, script: p.script?.name ?? null });
      } catch {
        // a damaged file stays on disk, out of the list
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  load(id: string): Production | null {
    if (!ID.test(id)) return null;
    const path = this.#path(id);
    if (!existsSync(path)) return null;
    return parseProduction(JSON.parse(readFileSync(path, "utf8")));
  }

  save(production: Production): void {
    mkdirSync(this.dir, { recursive: true });
    const path = this.#path(production.id);
    const tmp = `${path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(production, null, 2)}\n`);
    if (existsSync(path)) copyFileSync(path, `${path}.bak`);
    renameSync(tmp, path);
  }

  delete(id: string): void {
    if (!ID.test(id)) return;
    rmSync(this.#path(id), { force: true });
    rmSync(`${this.#path(id)}.bak`, { force: true });
  }

  #path(id: string): string {
    return join(this.dir, `${id}.json`);
  }
}
