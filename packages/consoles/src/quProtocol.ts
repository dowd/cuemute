// Allen & Heath Qu MIDI protocol (Qu Mixer MIDI Protocol V1.9+), the parts
// cuemute uses: input mutes, Get System State, and channel names.
// https://www.allen-heath.com/content/uploads/2023/06/Qu_MIDI_Protocol_V1.9.pdf

export const QU_PORT = 51325;
export const QU_INPUTS = 32;

// channel numbers (CH) from the doc's table
const CH_INPUT_BASE = 0x20; // Input 1-32 = 20..3F

// SysEx: F0 00 00 1A 50 11 01 00, then 0N (MIDI channel, 7F for All Call), then the command
const SYSEX_PREFIX = [0xf0, 0x00, 0x00, 0x1a, 0x50, 0x11, 0x01, 0x00];
const ALL_CALL = 0x7f;
export const SYSEX = {
  getName: 0x01,
  nameReply: 0x02,
  getSystemState: 0x10,
  systemStateReply: 0x11,
  endSync: 0x14,
} as const;

export const BOX_IDS: Record<number, string> = {
  1: "Qu-16",
  2: "Qu-24",
  3: "Qu-32",
  4: "Qu-Pac",
  5: "Qu-SB",
};

export function inputToChannelId(input: number): number {
  return CH_INPUT_BASE + input - 1;
}

// the input number for a Qu channel id, or null for FX, mixes, DCAs...
export function channelIdToInput(ch: number): number | null {
  const n = ch - CH_INPUT_BASE + 1;
  return n >= 1 && n <= QU_INPUTS ? n : null;
}

// Mute is a Note On carrying the state (velocity 7F mutes, 3F unmutes), then a
// Note Off (velocity 0). The desk ignores velocity 0, so the state rides the first.
export function encodeMute(midiChannel: number, input: number, muted: boolean): Uint8Array {
  const status = 0x90 | (midiChannel & 0x0f);
  const ch = inputToChannelId(input);
  return Uint8Array.of(status, ch, muted ? 0x7f : 0x3f, status, ch, 0x00);
}

// Received Note On: velocity 01-3F unmuted, 40-7F muted, 00 ignored.
export function decodeMuteVelocity(velocity: number): boolean | null {
  if (velocity === 0) return null;
  return velocity >= 0x40;
}

// Get System State with the All Call header (the desk's channel isn't known
// yet) and iPad flag 0: set, the desk treats us as Qu-Pad and drops the
// connection unless Active Sensing starts within 5 s.
export function encodeGetSystemState(): Uint8Array {
  return Uint8Array.of(...SYSEX_PREFIX, ALL_CALL, SYSEX.getSystemState, 0x00, 0xf7);
}

export function encodeGetName(midiChannel: number, input: number): Uint8Array {
  return Uint8Array.of(...SYSEX_PREFIX, midiChannel & 0x0f, SYSEX.getName, inputToChannelId(input), 0xf7);
}

export type QuSysEx =
  | { kind: "systemState"; midiChannel: number; model: string; firmware: string }
  | { kind: "endSync"; midiChannel: number }
  | { kind: "name"; midiChannel: number; input: number; name: string };

// one of the Qu SysEx replies cuemute understands, or null
export function decodeSysEx(data: Uint8Array): QuSysEx | null {
  const p = SYSEX_PREFIX.length;
  if (data.length < p + 3) return null;
  for (let i = 0; i < p; i++) if (data[i] !== SYSEX_PREFIX[i]) return null;

  const midiChannel = data[p]! & 0x0f;
  const command = data[p + 1];
  const body = data.subarray(p + 2, data.length - 1); // without the trailing F7

  switch (command) {
    case SYSEX.systemStateReply: {
      const [box = 0, major = 0, minor = 0] = body;
      return {
        kind: "systemState",
        midiChannel,
        model: BOX_IDS[box] ?? `Qu (model ${box})`,
        firmware: `${major}.${minor}`,
      };
    }
    case SYSEX.endSync:
      return { kind: "endSync", midiChannel };
    case SYSEX.nameReply: {
      const input = channelIdToInput(body[0] ?? 0);
      if (input === null) return null;
      const name = String.fromCharCode(...body.subarray(1)).replace(/\0+$/, "").trim();
      return { kind: "name", midiChannel, input, name };
    }
    default:
      return null;
  }
}
