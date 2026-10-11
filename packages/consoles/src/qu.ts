import { connect as tcpConnect, type Socket } from "node:net";
import type { Target } from "@cuemute/core";
import { Console } from "./console.ts";
import { MidiParser, type MidiMessage } from "./midi.ts";
import {
  QU_INPUTS,
  QU_PORT,
  channelIdToInput,
  decodeMuteVelocity,
  decodeSysEx,
  encodeGetName,
  encodeGetSystemState,
  encodeMute,
} from "./quProtocol.ts";

export interface QuOptions {
  port?: number;
  reconnectMs?: number;
  // once the desk has shown it sends Active Sensing, this much silence means
  // the link is dead even if TCP hasn't noticed
  silenceMs?: number;
  syncTimeoutMs?: number;
  nameTimeoutMs?: number;
}

const KEEPALIVE_MS = 5000; // the desk closes the link after 12 s without data from us

// Allen & Heath Qu over MIDI/TCP. On connect it sends Get System State; the
// desk replies with its model and MIDI channel, pushes its current state as
// ordinary messages, then signals the end of the sync.
export class QuConsole extends Console {
  readonly inputCount = QU_INPUTS;
  readonly #host: string;
  readonly #opts: Required<QuOptions>;
  readonly #parser = new MidiParser((m) => this.#onMessage(m));

  #socket: Socket | null = null;
  #wanted = false;
  #midiChannel = 0; // learned from the desk's reply
  #lastData = 0;
  #deskSendsSensing = false;
  #timers: ReturnType<typeof setInterval>[] = [];
  #reconnect: ReturnType<typeof setTimeout> | undefined;
  #syncTimer: ReturnType<typeof setTimeout> | undefined;
  #names: { result: Map<number, string>; done: () => void } | null = null;

  constructor(host: string, options: QuOptions = {}) {
    super();
    this.#host = host;
    this.#opts = {
      port: options.port ?? QU_PORT,
      reconnectMs: options.reconnectMs ?? 2000,
      silenceMs: options.silenceMs ?? 5000,
      syncTimeoutMs: options.syncTimeoutMs ?? 10000,
      nameTimeoutMs: options.nameTimeoutMs ?? 3000,
    };
  }

  get midiChannel(): number {
    return this.#midiChannel + 1;
  }

  connect(): void {
    this.#wanted = true;
    this.#open();
  }

  disconnect(): void {
    this.#wanted = false;
    clearTimeout(this.#reconnect);
    this.#teardown();
    this.setState("disconnected");
  }

  setMute(target: Target, muted: boolean): void {
    if (this.state !== "connected" || target.kind !== "input") return;
    if (target.number < 1 || target.number > QU_INPUTS) return;
    this.#socket?.write(encodeMute(this.#midiChannel, target.number, muted));
  }

  // Asks for every input's name and returns the ones the desk answered within
  // the timeout.
  readChannelNames(): Promise<Map<number, string>> {
    return new Promise((resolve) => {
      const result = new Map<number, string>();
      if (this.state !== "connected" || !this.#socket) return resolve(result);
      const timer = setTimeout(() => done(), this.#opts.nameTimeoutMs);
      const done = () => {
        clearTimeout(timer);
        this.#names = null;
        resolve(result);
      };
      this.#names = { result, done };
      for (let n = 1; n <= QU_INPUTS; n++) this.#socket.write(encodeGetName(this.#midiChannel, n));
    });
  }

  #open(): void {
    this.setState("connecting");
    this.emit("info", `Connecting to Qu at ${this.#host}…`);
    this.#parser.reset();
    this.#deskSendsSensing = false;

    const socket = tcpConnect({ host: this.#host, port: this.#opts.port });
    socket.setNoDelay(true);
    this.#socket = socket;

    socket.on("connect", () => {
      this.#lastData = Date.now();
      this.setState("connected");
      socket.write(encodeGetSystemState());
      this.#timers.push(
        setInterval(() => socket.write(Uint8Array.of(0xfe)), KEEPALIVE_MS),
        setInterval(() => this.#checkSilence(), 1000),
      );
      this.#syncTimer = setTimeout(
        () => this.emit("info", "The Qu didn't send its state. Live mutes will appear as they change."),
        this.#opts.syncTimeoutMs,
      );
    });
    socket.on("data", (chunk: Buffer) => {
      this.#lastData = Date.now();
      this.#parser.feed(chunk);
    });
    socket.on("error", (err) => this.emit("info", `Qu: ${err.message}`));
    socket.on("close", () => {
      if (this.#socket !== socket) return; // an old socket we already replaced
      this.#teardown();
      if (!this.#wanted) return;
      this.setState("connecting");
      this.#reconnect = setTimeout(() => this.#open(), this.#opts.reconnectMs);
    });
  }

  #teardown(): void {
    for (const t of this.#timers) clearInterval(t);
    this.#timers = [];
    clearTimeout(this.#syncTimer);
    this.#names?.done();
    const socket = this.#socket;
    this.#socket = null;
    socket?.destroy();
  }

  #checkSilence(): void {
    if (!this.#deskSendsSensing) return;
    if (Date.now() - this.#lastData > this.#opts.silenceMs) {
      this.emit("info", "The Qu stopped responding. Reconnecting…");
      // close the socket so the reconnect path runs
      this.#socket?.destroy();
    }
  }

  #onMessage(m: MidiMessage): void {
    switch (m.type) {
      case "activeSensing":
        this.#deskSendsSensing = true;
        break;
      case "noteOn": {
        // the DAW strips use channel N+1; only N carries mutes
        if (m.channel !== this.#midiChannel) return;
        const input = channelIdToInput(m.note);
        const muted = decodeMuteVelocity(m.velocity);
        if (input !== null && muted !== null) this.emit("mute", { kind: "input", number: input }, muted);
        break;
      }
      case "sysex": {
        const r = decodeSysEx(m.data);
        if (!r) return;
        if (r.kind === "systemState") {
          this.#midiChannel = r.midiChannel;
          this.emit("info", `${r.model}, firmware ${r.firmware}, MIDI channel ${r.midiChannel + 1}`);
        } else if (r.kind === "endSync") {
          clearTimeout(this.#syncTimer);
          this.emit("synced");
        } else if (r.kind === "name" && this.#names) {
          this.#names.result.set(r.input, r.name);
          if (this.#names.result.size === QU_INPUTS) this.#names.done();
        }
        break;
      }
      default:
        break;
    }
  }
}
