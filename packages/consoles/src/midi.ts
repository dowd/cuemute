// A MIDI byte-stream parser for MIDI over TCP. Handles running status,
// real-time bytes (Active Sensing etc.) between messages, SysEx, and messages
// split across reads.

export type MidiMessage =
  | { type: "noteOn"; channel: number; note: number; velocity: number }
  | { type: "noteOff"; channel: number; note: number; velocity: number }
  | { type: "cc"; channel: number; controller: number; value: number }
  | { type: "programChange"; channel: number; program: number }
  | { type: "sysex"; data: Uint8Array } // including F0 and F7
  | { type: "activeSensing" };

// data bytes after a channel-voice status byte
function dataLength(status: number): number {
  const kind = status & 0xf0;
  return kind === 0xc0 || kind === 0xd0 ? 1 : 2;
}

// total length of a system common message (F1-F7, SysEx excluded)
function systemCommonLength(status: number): number {
  if (status === 0xf1 || status === 0xf3) return 2;
  if (status === 0xf2) return 3;
  return 1;
}

export class MidiParser {
  #buffer: number[] = [];
  #runningStatus = 0;
  readonly #onMessage: (m: MidiMessage) => void;

  constructor(onMessage: (m: MidiMessage) => void) {
    this.#onMessage = onMessage;
  }

  reset(): void {
    this.#buffer = [];
    this.#runningStatus = 0;
  }

  feed(bytes: Uint8Array): void {
    for (const b of bytes) this.#buffer.push(b);
    this.#drain();
  }

  #drain(): void {
    const buf = this.#buffer;
    let i = 0;
    while (i < buf.length) {
      const first = buf[i]!;

      if (first >= 0xf8) {
        if (first === 0xfe) this.#onMessage({ type: "activeSensing" });
        i += 1;
        continue;
      }

      if (first === 0xf0) {
        const end = buf.indexOf(0xf7, i);
        if (end < 0) break; // incomplete
        this.#onMessage({ type: "sysex", data: Uint8Array.from(buf.slice(i, end + 1)) });
        this.#runningStatus = 0;
        i = end + 1;
        continue;
      }

      if (first >= 0xf1) {
        const len = systemCommonLength(first);
        if (buf.length - i < len) break;
        this.#runningStatus = 0;
        i += len;
        continue;
      }

      // channel voice: explicit status, or data under running status
      let status: number;
      let offset: number;
      if (first & 0x80) {
        status = first;
        offset = 1;
      } else if (this.#runningStatus) {
        status = this.#runningStatus;
        offset = 0;
      } else {
        i += 1; // stray data byte
        continue;
      }

      const len = dataLength(status);
      if (buf.length - i < offset + len) break;
      const d1 = buf[i + offset]!;
      const d2 = len > 1 ? buf[i + offset + 1]! : 0;
      i += offset + len;
      this.#runningStatus = status;
      this.#dispatch(status, d1, d2);
    }
    this.#buffer = buf.slice(i);
  }

  #dispatch(status: number, d1: number, d2: number): void {
    const channel = status & 0x0f;
    switch (status & 0xf0) {
      case 0x90:
        this.#onMessage({ type: "noteOn", channel, note: d1, velocity: d2 });
        break;
      case 0x80:
        this.#onMessage({ type: "noteOff", channel, note: d1, velocity: d2 });
        break;
      case 0xb0:
        this.#onMessage({ type: "cc", channel, controller: d1, value: d2 });
        break;
      case 0xc0:
        this.#onMessage({ type: "programChange", channel, program: d1 });
        break;
      default:
        break;
    }
  }
}
