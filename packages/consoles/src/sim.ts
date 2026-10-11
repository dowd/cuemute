import { inputTarget, targetKey, type Target } from "@cuemute/core";
import { Console } from "./console.ts";

// An in-memory desk for programming without hardware and for tests. It behaves
// like a real one: it reports its state on connect, and changes made "on the
// desk" through deskChange() arrive as mute events.
export class SimConsole extends Console {
  readonly inputCount: number;
  readonly #mutes = new Map<string, boolean>();

  constructor(inputCount = 32) {
    super();
    this.inputCount = inputCount;
    // a desk at the start of a show: every input muted
    for (let n = 1; n <= inputCount; n++) this.#mutes.set(targetKey(inputTarget(n)), true);
  }

  connect(): void {
    this.setState("connecting");
    queueMicrotask(() => {
      this.setState("connected");
      for (let n = 1; n <= this.inputCount; n++) {
        const t = inputTarget(n);
        this.emit("mute", t, this.#mutes.get(targetKey(t)) ?? true);
      }
      this.emit("synced");
      this.emit("info", `Simulated desk, ${this.inputCount} inputs`);
    });
  }

  disconnect(): void {
    this.setState("disconnected");
  }

  setMute(target: Target, muted: boolean): void {
    if (this.state !== "connected" || target.number > this.inputCount) return;
    this.#mutes.set(targetKey(target), muted);
    // real desks don't reliably echo what we send; the app tracks its own sends
  }

  // a change made by hand on the "desk"
  deskChange(target: Target, muted: boolean): void {
    if (target.number < 1 || target.number > this.inputCount) return;
    this.#mutes.set(targetKey(target), muted);
    if (this.state === "connected") this.emit("mute", target, muted);
  }

  isMuted(target: Target): boolean | undefined {
    return this.#mutes.get(targetKey(target));
  }
}
