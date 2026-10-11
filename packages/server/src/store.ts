import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createShow, parseShow, type Show } from "@cuemute/core";

// One JSON file per show. Each save keeps the previous version as <file>.bak
// and writes through a temp file, so a crash mid-save never leaves a half file.
export class ShowStore {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  // the show at path, or a new empty one if the file doesn't exist yet
  load(): Show {
    if (!existsSync(this.path)) return createShow();
    return parseShow(JSON.parse(readFileSync(this.path, "utf8")));
  }

  save(show: Show): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(show, null, 2)}\n`);
    if (existsSync(this.path)) copyFileSync(this.path, `${this.path}.bak`);
    renameSync(tmp, this.path);
  }
}
