import { connect as tcpConnect, type Socket } from "node:net";
import type { Target } from "@cuemute/core";
import { Console } from "./console.ts";
import { MidiParser, type MidiMessage } from "./midi.ts";
import { NrpnAssembler, SQ_INPUTS, SQ_PORT, decodeSqMute, encodeSqGetMute, encodeSqMute } from "./sqProtocol.ts";

export interface SqOptions {
  port?: number;
  reconnectMs?: number;
  // once the desk has shown it sends Active Sensing, this much silence means
  // the link is dead even if TCP hasn't noticed
  silenceMs?: number;
  syncTimeoutMs?: number;
  // gets sent per batch, and the pause between batches
  getBatch?: number;
  getIntervalMs?: number;
}

// Allen & Heath SQ over MIDI/TCP. The SQ has no bulk sync and can't report its
// MIDI channel, so the operator sets the channel and on connect the driver
// asks for each input's mute, a few at a time.
export class SqConsole extends Console {
  readonly inputCount = SQ_INPUTS;
  readonly #host: string;
  readonly #midiChannel: number; // 0-15
  readonly #opts: Required<SqOptions>;
  readonly #parser = new MidiParser((m) => this.#onMessage(m));
  readonly #nrpn = new NrpnAssembler();

  #socket: Socket | null = null;
  #wanted = false;
  #lastData = 0;
  #deskSendsSensing = false;
  #timers: ReturnType<typeof setInterval>[] = [];
  #reconnect: ReturnType<typeof setTimeout> | undefined;
  #syncTimer: ReturnType<typeof setTimeout> | undefined;
  // inputs not yet answered in the connect-time read; null once synced
  #pending: Set<number> | null = null;

  // midiChannel is 1-16, as set on the desk
  constructor(host: string, midiChannel: number, options: SqOptions = {}) {
    super();
    this.#host = host;
    this.#midiChannel = (midiChannel - 1) & 0x0f;
    this.#opts = {
      port: options.port ?? SQ_PORT,
      reconnectMs: options.reconnectMs ?? 2000,
      silenceMs: options.silenceMs ?? 5000,
      syncTimeoutMs: options.syncTimeoutMs ?? 5000,
      getBatch: options.getBatch ?? 8,
      getIntervalMs: options.getIntervalMs ?? 10,
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
    if (target.number < 1 || target.number > SQ_INPUTS) return;
    this.#socket?.write(encodeSqMute(this.#midiChannel, target.number, muted));
  }

  #open(): void {
    this.setState("connecting");
    this.emit("info", `Connecting to SQ at ${this.#host}…`);
    this.#parser.reset();
    this.#nrpn.reset();
    this.#deskSendsSensing = false;

    const socket = tcpConnect({ host: this.#host, port: this.#opts.port });
    socket.setNoDelay(true);
    // The SQ doesn't document what it does with Active Sensing from us, so
    // TCP keep-alive finds a dead link instead.
    socket.setKeepAlive(true, 5000);
    this.#socket = socket;

    socket.on("connect", () => {
      this.#lastData = Date.now();
      this.setState("connected");
      this.#timers.push(setInterval(() => this.#checkSilence(), 1000));
      this.#readMutes(socket);
    });
    socket.on("data", (chunk: Buffer) => {
      this.#lastData = Date.now();
      this.#parser.feed(chunk);
    });
    socket.on("error", (err) => this.emit("info", `SQ: ${err.message}`));
    socket.on("close", () => {
      if (this.#socket !== socket) return; // an old socket we already replaced
      this.#teardown();
      if (!this.#wanted) return;
      this.setState("connecting");
      this.#reconnect = setTimeout(() => this.#open(), this.#opts.reconnectMs);
    });
  }

  // Asks for every input's mute, paced so the desk's input buffer keeps up.
  #readMutes(socket: Socket): void {
    const pending = new Set<number>();
    for (let n = 1; n <= SQ_INPUTS; n++) pending.add(n);
    this.#pending = pending;

    let next = 1;
    const sender = setInterval(() => {
      const last = Math.min(next + this.#opts.getBatch - 1, SQ_INPUTS);
      for (; next <= last; next++) socket.write(encodeSqGetMute(this.#midiChannel, next));
      if (next > SQ_INPUTS) clearInterval(sender);
    }, this.#opts.getIntervalMs);
    this.#timers.push(sender);

    this.#syncTimer = setTimeout(() => {
      if (pending.size === SQ_INPUTS) {
        this.#pending = null;
        this.emit(
          "info",
          `The SQ didn't answer. Check the MIDI channel matches the desk (Utility > General > MIDI, now ${this.midiChannel}).`,
        );
        return;
      }
      this.emit("info", `The SQ didn't report ${pending.size} of ${SQ_INPUTS} inputs. They will appear as they change.`);
      this.#finishSync();
    }, this.#opts.syncTimeoutMs);
  }

  #finishSync(): void {
    clearTimeout(this.#syncTimer);
    this.#pending = null;
    this.emit("synced");
  }

  #teardown(): void {
    for (const t of this.#timers) clearInterval(t);
    this.#timers = [];
    clearTimeout(this.#syncTimer);
    this.#pending = null;
    const socket = this.#socket;
    this.#socket = null;
    socket?.destroy();
  }

  #checkSilence(): void {
    if (!this.#deskSendsSensing) return;
    if (Date.now() - this.#lastData > this.#opts.silenceMs) {
      this.emit("info", "The SQ stopped responding. Reconnecting…");
      // close the socket so the reconnect path runs
      this.#socket?.destroy();
    }
  }

  #onMessage(m: MidiMessage): void {
    if (m.type === "activeSensing") {
      this.#deskSendsSensing = true;
      return;
    }
    if (m.type !== "cc" || m.channel !== this.#midiChannel) return;
    const nrpn = this.#nrpn.cc(m.controller, m.value);
    const mute = nrpn && decodeSqMute(nrpn);
    if (!mute) return;

    this.emit("mute", { kind: "input", number: mute.input }, mute.muted);
    if (this.#pending?.delete(mute.input) && this.#pending.size === 0) {
      this.emit("info", `SQ on MIDI channel ${this.midiChannel}`);
      this.#finishSync();
    }
  }
}
