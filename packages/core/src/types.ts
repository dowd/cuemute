// A thing on the desk that can be muted. Only inputs exist today; DCAs and
// mute groups become new kinds later without changing the shape.
export type TargetKind = "input";

export interface Target {
  kind: TargetKind;
  number: number; // 1-based, as printed on the desk
}

export interface Change {
  target: Target;
  muted: boolean;
}

export interface Scene {
  id: string;
  number: string; // free-text label such as "12A"; order comes from position
  name: string;
  // free-text group, e.g. "Act 1 Sc 2 Bakery"; neighbouring scenes with the
  // same group show under one heading. Blank for no group.
  group: string;
  lineRef: string;
  notes: string;
  colour: string;
  changes: Change[];
}

// a channel the show manages, with the operator's own name for it
export interface Channel {
  number: number;
  name: string;
}

export type ConsoleType = "sim" | "qu" | "sq";

export interface ConsoleSettings {
  type: ConsoleType;
  host: string;
  midiChannel: number; // 1-16; SQ only, Qu reports its own
}

export interface Show {
  schemaVersion: 1;
  name: string;
  channels: Channel[];
  scenes: Scene[];
  console: ConsoleSettings;
}

// live or computed mute state, keyed by targetKey()
export type MuteState = Record<string, boolean>;

export type Mode = "show" | "edit";

export type ConnectionState = "disconnected" | "connecting" | "connected";

// everything a screen needs, pushed by the server on every change
export interface Snapshot {
  show: Show;
  cursor: { current: string | null; next: string | null };
  mode: Mode;
  live: MuteState;
  connection: { type: ConsoleType; state: ConnectionState; synced: boolean; info: string };
  duplicateNumbers: string[];
}
