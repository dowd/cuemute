import { EventEmitter } from "node:events";
import {
  back,
  deleteScene,
  duplicateNumbers,
  go,
  initialCursor,
  inputTarget,
  insertScene,
  jump,
  moveScene,
  newScene,
  normalizeCursor,
  orderForSending,
  recordChanges,
  setChannels,
  targetKey,
  updateScene,
  type Channel,
  type ConsoleSettings,
  type Cursor,
  type Mode,
  type MuteState,
  type Scene,
  type ScenePatch,
  type Show,
  type Snapshot,
  type Target,
} from "@cuemute/core";
import type { Console } from "@cuemute/consoles";

// An error the HTTP layer turns into a response with this status.
export class EngineError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export interface EngineOptions {
  show: Show;
  save: (show: Show) => void;
  createConsole: (settings: ConsoleSettings) => Console | null;
}

// The single source of truth. Every screen and the HTTP API act through it,
// and it emits "change" after anything that alters the snapshot.
export class Engine extends EventEmitter<{ change: [] }> {
  #show: Show;
  #cursor: Cursor = initialCursor;
  #mode: Mode = "edit";
  #live: MuteState = {};
  #atLastGo: MuteState = {};
  #console: Console | null = null;
  #synced = false;
  #info = "";
  readonly #save: (show: Show) => void;
  readonly #createConsole: EngineOptions["createConsole"];

  constructor(options: EngineOptions) {
    super();
    this.#show = options.show;
    this.#save = options.save;
    this.#createConsole = options.createConsole;
    this.#cursor = normalizeCursor(this.#show.scenes, initialCursor);
  }

  get console(): Console | null {
    return this.#console;
  }

  snapshot(): Snapshot {
    return {
      show: this.#show,
      cursor: this.#cursor,
      mode: this.#mode,
      live: this.#live,
      connection: {
        type: this.#show.console.type,
        state: this.#console?.state ?? "disconnected",
        synced: this.#synced,
        info: this.#info,
      },
      duplicateNumbers: [...duplicateNumbers(this.#show.scenes)],
    };
  }

  // --- desk connection ---

  connect(): void {
    this.disconnect();
    const c = this.#createConsole(this.#show.console);
    if (!c) {
      this.#info = `No driver for "${this.#show.console.type}" yet`;
      this.#changed();
      return;
    }
    this.#console = c;
    c.on("mute", (target, muted) => {
      this.#live = { ...this.#live, [targetKey(target)]: muted };
      this.#changed();
    });
    c.on("state", (state) => {
      if (state !== "connected") {
        // what we knew is stale; the desk is read again on reconnect
        this.#synced = false;
        this.#live = {};
      }
      this.#changed();
    });
    c.on("synced", () => {
      this.#synced = true;
      this.#changed();
    });
    c.on("info", (message) => {
      this.#info = message;
      this.#changed();
    });
    c.connect();
  }

  disconnect(): void {
    if (!this.#console) return;
    this.#console.removeAllListeners();
    this.#console.disconnect();
    this.#console = null;
    this.#live = {};
    this.#synced = false;
    this.#info = "";
    this.#changed();
  }

  // --- operation: allowed in Show and Edit mode ---

  go(): Scene | null {
    this.#requireDesk();
    const step = go(this.#show.scenes, this.#cursor);
    this.#cursor = step.cursor;
    if (step.fire) this.#fire(step.fire);
    this.#changed();
    return step.fire;
  }

  back(): void {
    this.#cursor = back(this.#show.scenes, this.#cursor);
    this.#changed();
  }

  jump(id: string): Scene {
    this.#requireDesk();
    const step = jump(this.#show.scenes, id);
    if (!step.fire) throw new EngineError(404, "No such scene");
    this.#cursor = step.cursor;
    this.#fire(step.fire);
    this.#changed();
    return step.fire;
  }

  // one channel, outside any scene (Companion buttons, the grid)
  setMute(number: number, muted: boolean): void {
    const desk = this.#requireDesk();
    if (number < 1 || number > desk.inputCount) throw new EngineError(400, "No such channel");
    this.#send(inputTarget(number), muted);
    this.#changed();
  }

  setMode(mode: Mode): void {
    this.#mode = mode;
    this.#changed();
  }

  // --- programming: Edit mode only ---

  // Captures the desk's changes since the last GO as a new scene after the
  // current one (at the top when nothing has fired, in which case every
  // reported show channel is captured).
  record(): Scene {
    this.#requireEdit();
    this.#requireDesk();
    if (!this.#synced) throw new EngineError(409, "Still reading the desk");
    const changes = recordChanges(this.#live, this.#atLastGo, this.#show.channels);
    if (changes.length === 0) throw new EngineError(409, "Nothing has changed since the last GO");
    const scene = newScene({ changes });
    this.#edit(insertScene(this.#show, this.#cursor.current, scene));
    // the recorded state is the new baseline, as if this scene had just fired
    this.#atLastGo = { ...this.#live };
    this.#cursor = { current: scene.id, next: this.#cursor.next };
    this.#changed();
    return scene;
  }

  addScene(afterId: string | null, fields: ScenePatch): Scene {
    this.#requireEdit();
    const scene = newScene(fields);
    this.#edit(insertScene(this.#show, afterId, scene));
    return scene;
  }

  updateScene(id: string, patch: ScenePatch): void {
    this.#requireEdit();
    this.#requireScene(id);
    this.#edit(updateScene(this.#show, id, patch));
  }

  deleteScene(id: string): void {
    this.#requireEdit();
    this.#requireScene(id);
    this.#edit(deleteScene(this.#show, id));
  }

  moveScene(id: string, toIndex: number): void {
    this.#requireEdit();
    this.#requireScene(id);
    this.#edit(moveScene(this.#show, id, toIndex));
  }

  setChannels(channels: Channel[]): void {
    this.#requireEdit();
    this.#edit(setChannels(this.#show, channels));
  }

  renameShow(name: string): void {
    this.#requireEdit();
    this.#edit({ ...this.#show, name });
  }

  setConsoleSettings(settings: ConsoleSettings): void {
    this.#requireEdit();
    this.#edit({ ...this.#show, console: settings });
    this.connect();
  }

  // copies names from the desk into the show's channels, for channels it has
  async importChannelNames(): Promise<number> {
    this.#requireEdit();
    const desk = this.#requireDesk();
    if (!desk.readChannelNames) throw new EngineError(409, "This desk can't report channel names");
    const names = await desk.readChannelNames();
    let count = 0;
    const channels = this.#show.channels.map((ch) => {
      const name = names.get(ch.number);
      if (name === undefined) return ch;
      count++;
      return { ...ch, name };
    });
    this.#edit(setChannels(this.#show, channels));
    return count;
  }

  // --- internals ---

  #fire(scene: Scene): void {
    for (const c of orderForSending(scene.changes)) this.#send(c.target, c.muted);
    this.#atLastGo = { ...this.#live };
  }

  // desks don't reliably echo what we send, so live state records our own sends
  #send(target: Target, muted: boolean): void {
    this.#console?.setMute(target, muted);
    this.#live = { ...this.#live, [targetKey(target)]: muted };
  }

  #edit(show: Show): void {
    this.#show = show;
    this.#cursor = normalizeCursor(show.scenes, this.#cursor);
    this.#save(show);
    this.#changed();
  }

  #requireDesk(): Console {
    if (!this.#console || this.#console.state !== "connected") {
      throw new EngineError(409, "Desk not connected");
    }
    return this.#console;
  }

  #requireEdit(): void {
    if (this.#mode !== "edit") throw new EngineError(409, "Switch to Edit mode to change the show");
  }

  #requireScene(id: string): void {
    if (!this.#show.scenes.some((s) => s.id === id)) throw new EngineError(404, "No such scene");
  }

  #changed(): void {
    this.emit("change");
  }
}
