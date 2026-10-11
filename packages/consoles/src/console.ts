import { EventEmitter } from "node:events";
import type { ConnectionState, Target } from "@cuemute/core";

export type { ConnectionState };

export interface ConsoleEvents {
  // a mute reported by the desk: a change made on it, or part of the connect-time read
  mute: [target: Target, muted: boolean];
  state: [state: ConnectionState];
  // the connect-time read finished; live state is complete
  synced: [];
  // something worth showing the operator, e.g. "Qu-32 on MIDI channel 1"
  info: [message: string];
}

// One mixing desk. Drivers turn protocol bytes into these events and calls.
export abstract class Console extends EventEmitter<ConsoleEvents> {
  #state: ConnectionState = "disconnected";

  get state(): ConnectionState {
    return this.#state;
  }

  protected setState(state: ConnectionState): void {
    if (state === this.#state) return;
    this.#state = state;
    this.emit("state", state);
  }

  // inputs the desk has, for range checks and the simulated desk
  abstract readonly inputCount: number;

  abstract connect(): void;
  abstract disconnect(): void;
  abstract setMute(target: Target, muted: boolean): void;

  // optional: Qu can report channel names, SQ can't
  readChannelNames?(): Promise<Map<number, string>>;
}
