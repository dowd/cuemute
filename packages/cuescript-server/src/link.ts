import { EventEmitter } from "node:events";
import { linkOff, type Link, type LinkedScene, type LinkState } from "@cuemute/script";
import { HttpError } from "./productions.ts";

const RETRY_MS = 2000;
const TIMEOUT_MS = 4000;

// The parts of a cuemute snapshot that cuescript reads.
interface CuemuteSnapshot {
  show: { name: string; scenes: { id: string; number: string; name: string; lineRef: string }[] };
  file: string | null;
  cursor: { current: string | null; next: string | null };
  mode: "show" | "edit";
}

// "192.168.1.10:4000" or "http://192.168.1.10:4000/" both mean http://192.168.1.10:4000
export function cuemuteOrigin(address: string): string {
  const withScheme = /^https?:\/\//i.test(address.trim()) ? address.trim() : `http://${address.trim()}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new HttpError(400, `"${address}" isn't a cuemute address`);
  }
  return url.origin;
}

// Calls cuemute's HTTP API. cuemute's own errors come back with its message.
export async function cuemuteApi<T>(origin: string, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${origin}/api${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new HttpError(502, `Can't reach cuemute at ${origin}`);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const message = data.error ?? `cuemute refused (${res.status})`;
    if (message === "Switch to Edit mode to change the show") {
      throw new HttpError(409, "Switch cuemute to Edit mode to change its scenes");
    }
    throw new HttpError(res.status === 404 ? 404 : 502, `cuemute: ${message}`);
  }
  return data;
}

// One live connection to cuemute's WebSocket. It reconnects on its own and
// emits "state" when anything cuescript shows changes.
export class CuemuteLink extends EventEmitter<{ state: [LinkState] }> {
  readonly link: Link;
  #state: LinkState = linkOff;
  #socket: WebSocket | null = null;
  #retry: ReturnType<typeof setTimeout> | undefined;
  #stopped = false;

  constructor(link: Link) {
    super();
    this.link = link;
  }

  get state(): LinkState {
    return this.#state;
  }

  start(): void {
    this.#stopped = false;
    this.#set({ ...linkOff, status: "connecting", message: `Connecting to cuemute at ${this.link.url}…` });
    this.#open();
  }

  stop(): void {
    this.#stopped = true;
    clearTimeout(this.#retry);
    this.#socket?.close();
    this.#socket = null;
    this.removeAllListeners();
  }

  #open(): void {
    const ws = this.link.url.replace(/^http/, "ws");
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${ws}/ws`);
    } catch {
      this.#lost();
      return;
    }
    this.#socket = socket;
    socket.onmessage = (e) => {
      try {
        this.#snapshot(JSON.parse(String(e.data)) as CuemuteSnapshot);
      } catch {
        // not a snapshot; the next one will do
      }
    };
    socket.onclose = () => this.#lost();
    socket.onerror = () => socket.close();
  }

  #lost(): void {
    this.#socket = null;
    if (this.#stopped) return;
    this.#set({ ...linkOff, status: "unreachable", message: `Can't reach cuemute at ${this.link.url}` });
    this.#retry = setTimeout(() => this.#open(), RETRY_MS);
  }

  #snapshot(s: CuemuteSnapshot): void {
    if (this.link.show && s.file !== this.link.show) {
      this.#set({
        ...linkOff,
        status: "other-show",
        message: `cuemute has "${s.show.name}" open, not this production's show (${this.link.show})`,
      });
      return;
    }
    const scenes: LinkedScene[] = s.show.scenes.map(({ id, number, name, lineRef }) => ({ id, number, name, lineRef }));
    this.#set({ status: "connected", message: "", mode: s.mode, current: s.cursor.current, next: s.cursor.next, scenes });
  }

  // cuemute sends a snapshot for every mute; only a change cuescript shows goes on
  #set(state: LinkState): void {
    if (JSON.stringify(state) === JSON.stringify(this.#state)) return;
    this.#state = state;
    this.emit("state", state);
  }
}
