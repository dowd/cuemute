import { EventEmitter } from "node:events";
import { linkOff, type LinkState } from "@cuemute/script";
import { CuemuteLink } from "./link.ts";
import type { Productions } from "./productions.ts";

// Keeps a cuemute link open for each linked production that a screen is
// watching, and closes it when the last screen goes. While connected, it keeps
// the copies of scene numbers and names in the production up to date.
export class Links extends EventEmitter<{ state: [id: string, state: LinkState] }> {
  readonly #productions: Productions;
  readonly #links = new Map<string, CuemuteLink>();
  readonly #watchers = new Map<string, number>();

  constructor(productions: Productions) {
    super();
    this.#productions = productions;
    // a new or changed link reconnects; the same link carries on
    productions.on("change", (id) => {
      if (this.#watchers.has(id)) this.#sync(id);
    });
    productions.on("deleted", (id) => this.#close(id));
  }

  state(id: string): LinkState {
    return this.#links.get(id)?.state ?? linkOff;
  }

  watch(id: string): void {
    this.#watchers.set(id, (this.#watchers.get(id) ?? 0) + 1);
    this.#sync(id);
  }

  unwatch(id: string): void {
    const n = (this.#watchers.get(id) ?? 1) - 1;
    if (n > 0) {
      this.#watchers.set(id, n);
      return;
    }
    this.#watchers.delete(id);
    this.#close(id);
  }

  closeAll(): void {
    for (const id of [...this.#links.keys()]) this.#close(id);
  }

  #sync(id: string): void {
    const link = this.#productions.get(id).link;
    const open = this.#links.get(id);
    if (open && link && open.link.url === link.url && open.link.show === link.show) return;
    this.#close(id);
    if (!link) {
      this.emit("state", id, linkOff);
      return;
    }
    const conn = new CuemuteLink(link);
    this.#links.set(id, conn);
    conn.on("state", (state) => {
      if (state.status === "connected") this.#productions.syncScenes(id, state.scenes);
      this.emit("state", id, state);
    });
    conn.start();
  }

  #close(id: string): void {
    const open = this.#links.get(id);
    if (!open) return;
    open.stop();
    this.#links.delete(id);
  }
}
