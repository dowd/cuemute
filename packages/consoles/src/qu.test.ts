import { createServer, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { inputTarget } from "@cuemute/core";
import { MidiParser, type MidiMessage } from "./midi.ts";
import { QuConsole } from "./qu.ts";
import { decodeSysEx, encodeGetName, encodeGetSystemState, encodeMute } from "./quProtocol.ts";

const hex = (s: string) => Uint8Array.from(Buffer.from(s.replace(/\s/g, ""), "hex"));
const toHex = (b: Uint8Array) => Buffer.from(b).toString("hex").toUpperCase();

function parse(...chunks: string[]): MidiMessage[] {
  const out: MidiMessage[] = [];
  const p = new MidiParser((m) => out.push(m));
  for (const c of chunks) p.feed(hex(c));
  return out;
}

describe("MidiParser", () => {
  it("reads note pairs and CCs", () => {
    expect(parse("90 20 7F 90 20 00")).toEqual([
      { type: "noteOn", channel: 0, note: 0x20, velocity: 0x7f },
      { type: "noteOn", channel: 0, note: 0x20, velocity: 0 },
    ]);
  });

  it("handles running status", () => {
    const m = parse("90 20 7F 20 00 21 3F");
    expect(m.map((x) => x.type === "noteOn" && [x.note, x.velocity])).toEqual([
      [0x20, 0x7f],
      [0x20, 0x00],
      [0x21, 0x3f],
    ]);
  });

  it("drops Active Sensing between messages and reports it", () => {
    const m = parse("FE 90 20 7F FE");
    expect(m.map((x) => x.type)).toEqual(["activeSensing", "noteOn", "activeSensing"]);
  });

  it("joins messages split across reads", () => {
    const m = parse("90 20", "7F F0 00 00 1A", "50 11 01 00 00 14 F7");
    expect(m.map((x) => x.type)).toEqual(["noteOn", "sysex"]);
  });

  it("parses program changes (one data byte)", () => {
    expect(parse("C0 05 90 20 7F")).toEqual([
      { type: "programChange", channel: 0, program: 5 },
      { type: "noteOn", channel: 0, note: 0x20, velocity: 0x7f },
    ]);
  });
});

describe("Qu protocol (Qu MIDI Protocol V1.9)", () => {
  it("encodes mutes as a Note On carrying the state, then a Note Off", () => {
    // p5: mute on 9N CH 7F 9N CH 00, mute off 9N CH 3F 9N CH 00; Input 1 = CH 20
    expect(toHex(encodeMute(0, 1, true))).toBe("90207F902000");
    expect(toHex(encodeMute(0, 1, false))).toBe("90203F902000");
    expect(toHex(encodeMute(2, 32, true))).toBe("923F7F923F00"); // Input 32, channel 3
  });

  it("asks for system state with the All Call header", () => {
    expect(toHex(encodeGetSystemState())).toBe("F000001A501101007F1000F7");
  });

  it("asks for a channel name", () => {
    expect(toHex(encodeGetName(0, 1))).toBe("F000001A5011010000" + "0120F7");
  });

  it("decodes the system state reply, end of sync and names", () => {
    expect(decodeSysEx(hex("F0 00 00 1A 50 11 01 00 02 11 03 01 09 F7"))).toEqual({
      kind: "systemState",
      midiChannel: 2,
      model: "Qu-32",
      firmware: "1.9",
    });
    expect(decodeSysEx(hex("F0 00 00 1A 50 11 01 00 00 14 F7"))).toEqual({ kind: "endSync", midiChannel: 0 });
    // "Ana" for Input 1
    expect(decodeSysEx(hex("F0 00 00 1A 50 11 01 00 00 02 20 41 6E 61 F7"))).toEqual({
      kind: "name",
      midiChannel: 0,
      input: 1,
      name: "Ana",
    });
    expect(decodeSysEx(hex("F0 00 00 1A 50 10 01 00 00 14 F7"))).toBeNull(); // GLD header
  });
});

// A fake Qu on a local port: answers Get System State like the doc describes.
class FakeQu {
  server: Server;
  socket: Socket | null = null;
  received: Buffer[] = [];
  port = 0;
  midiChannel = 0;

  constructor() {
    this.server = createServer((s) => {
      this.socket = s;
      s.on("data", (d: Buffer) => {
        this.received.push(d);
        if (d.includes(Buffer.from(encodeGetSystemState()))) this.#sendState(s);
      });
    });
  }

  async listen(): Promise<void> {
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.port = (this.server.address() as { port: number }).port;
  }

  #sendState(s: Socket): void {
    const n = this.midiChannel.toString(16).padStart(2, "0");
    const note = (0x90 | this.midiChannel).toString(16);
    // reply, then state as ordinary messages, then end of sync
    s.write(hex(`F0 00 00 1A 50 11 01 00 ${n} 11 03 01 09 F7`));
    s.write(hex(`${note} 20 7F ${note} 20 00 ${note} 21 3F ${note} 21 00`)); // in1 muted, in2 open
    s.write(hex(`F0 00 00 1A 50 11 01 00 ${n} 14 F7`));
  }

  deskMute(input: number, muted: boolean): void {
    const status = 0x90 | this.midiChannel;
    this.socket?.write(Uint8Array.of(status, 0x1f + input, muted ? 0x7f : 0x3f, status, 0x1f + input, 0));
  }

  close(): Promise<void> {
    this.socket?.destroy();
    return new Promise((r) => this.server.close(() => r()));
  }
}

const waitFor = async (check: () => boolean, ms = 2000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error("timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
};

describe("QuConsole over TCP", () => {
  let fake: FakeQu;
  let qu: QuConsole;

  afterEach(async () => {
    qu?.disconnect();
    await fake?.close();
  });

  it("reads the desk on connect and follows its MIDI channel", async () => {
    fake = new FakeQu();
    fake.midiChannel = 2;
    await fake.listen();
    qu = new QuConsole("127.0.0.1", { port: fake.port });
    const mutes: [number, boolean][] = [];
    let synced = false;
    qu.on("mute", (t, m) => mutes.push([t.number, m]));
    qu.on("synced", () => (synced = true));
    qu.connect();

    await waitFor(() => synced);
    expect(qu.midiChannel).toBe(3);
    expect(mutes).toEqual([
      [1, true],
      [2, false],
    ]);

    // a change on the desk arrives as a mute event
    fake.deskMute(5, false);
    await waitFor(() => mutes.length === 3);
    expect(mutes[2]).toEqual([5, false]);

    // what we send uses the desk's channel
    qu.setMute(inputTarget(1), false);
    await waitFor(() => Buffer.concat(fake.received).includes(Buffer.from("92203F922000", "hex")));
  });

  it("ignores the DAW strip channel (N+1)", async () => {
    fake = new FakeQu();
    await fake.listen();
    qu = new QuConsole("127.0.0.1", { port: fake.port });
    let synced = false;
    const mutes: number[] = [];
    qu.on("synced", () => (synced = true));
    qu.on("mute", (t) => mutes.push(t.number));
    qu.connect();
    await waitFor(() => synced);
    mutes.length = 0;
    fake.socket?.write(hex("91 20 7F 91 20 00"));
    fake.deskMute(3, true);
    await waitFor(() => mutes.length === 1);
    expect(mutes).toEqual([3]);
  });

  it("reconnects after the desk drops the link", async () => {
    fake = new FakeQu();
    await fake.listen();
    qu = new QuConsole("127.0.0.1", { port: fake.port, reconnectMs: 20 });
    const states: string[] = [];
    qu.on("state", (s) => states.push(s));
    qu.connect();
    await waitFor(() => qu.state === "connected");
    fake.socket?.destroy();
    await waitFor(() => states.filter((s) => s === "connected").length === 2);
    expect(states).toEqual(["connecting", "connected", "connecting", "connected"]);
  });

  it("reads channel names", async () => {
    fake = new FakeQu();
    await fake.listen();
    qu = new QuConsole("127.0.0.1", { port: fake.port, nameTimeoutMs: 200 });
    qu.connect();
    await waitFor(() => qu.state === "connected");
    const pending = qu.readChannelNames();
    await waitFor(() => Buffer.concat(fake.received).includes(Buffer.from(encodeGetName(0, 2))));
    fake.socket?.write(hex("F0 00 00 1A 50 11 01 00 00 02 21 42 65 6E F7")); // Input 2 "Ben"
    const names = await pending;
    expect([...names]).toEqual([[2, "Ben"]]);
  });
});
