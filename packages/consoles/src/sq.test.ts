import { createServer, type Server, type Socket } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { inputTarget } from "@cuemute/core";
import { SqConsole } from "./sq.ts";
import { NrpnAssembler, decodeSqMute, encodeSqGetMute, encodeSqMute, type Nrpn } from "./sqProtocol.ts";

const hex = (s: string) => Uint8Array.from(Buffer.from(s.replace(/\s/g, ""), "hex"));
const toHex = (b: Uint8Array) => Buffer.from(b).toString("hex").toUpperCase();

describe("SQ protocol (SQ MIDI Protocol Issue 4)", () => {
  it("encodes mutes as an NRPN", () => {
    // Mute Input 1 on, MIDI channel 1: B0 63 00 B0 62 00 B0 06 00 B0 26 01
    expect(toHex(encodeSqMute(0, 1, true))).toBe("B06300B06200B00600B02601");
    expect(toHex(encodeSqMute(0, 1, false))).toBe("B06300B06200B00600B02600");
    // Input 48 on channel 3
    expect(toHex(encodeSqMute(2, 48, true))).toBe("B26300B2622FB20600B22601");
  });

  it("encodes a get with Data Increment 7F", () => {
    expect(toHex(encodeSqGetMute(0, 1))).toBe("B06300B06200B0607F");
    expect(toHex(encodeSqGetMute(0, 12))).toBe("B06300B0620BB0607F");
  });

  it("assembles NRPNs and reads input mutes from them", () => {
    const a = new NrpnAssembler();
    const feed = (pairs: [number, number][]) => pairs.map(([c, v]) => a.cc(c, v)).filter((n): n is Nrpn => !!n);

    expect(feed([[0x63, 0x00], [0x62, 0x04], [0x06, 0x00], [0x26, 0x01]])).toEqual([
      { msb: 0, lsb: 4, vc: 0, vf: 1 },
    ]);
    // the desk can leave out an unchanged parameter
    expect(feed([[0x06, 0x00], [0x26, 0x00]])).toEqual([{ msb: 0, lsb: 4, vc: 0, vf: 0 }]);

    expect(decodeSqMute({ msb: 0, lsb: 4, vc: 0, vf: 1 })).toEqual({ input: 5, muted: true });
    expect(decodeSqMute({ msb: 0, lsb: 0x44, vc: 0, vf: 1 })).toBeNull(); // LR mute
    expect(decodeSqMute({ msb: 0x40, lsb: 0, vc: 0x62, vf: 0 })).toBeNull(); // a fader level
  });

  it("ignores a data byte before any parameter", () => {
    expect(new NrpnAssembler().cc(0x26, 1)).toBeNull();
  });
});

// A fake SQ on a local port: answers mute gets with the full NRPN.
class FakeSq {
  server: Server;
  socket: Socket | null = null;
  received: Buffer[] = [];
  port = 0;
  midiChannel = 0;
  muted = new Set<number>([1]);
  // inputs whose gets go unanswered
  silent = new Set<number>();

  constructor() {
    this.server = createServer((s) => {
      this.socket = s;
      s.on("data", (d: Buffer) => {
        this.received.push(d);
        for (let n = 1; n <= 48; n++) {
          if (this.silent.has(n)) continue;
          if (d.includes(Buffer.from(encodeSqGetMute(this.midiChannel, n)))) this.deskMute(n, this.muted.has(n));
        }
      });
    });
  }

  async listen(): Promise<void> {
    await new Promise<void>((r) => this.server.listen(0, "127.0.0.1", r));
    this.port = (this.server.address() as { port: number }).port;
  }

  deskMute(input: number, muted: boolean): void {
    this.socket?.write(encodeSqMute(this.midiChannel, input, muted));
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

describe("SqConsole over TCP", () => {
  let fake: FakeSq;
  let sq: SqConsole;

  afterEach(async () => {
    sq?.disconnect();
    await fake?.close();
  });

  it("reads every input on connect, then follows desk changes", async () => {
    fake = new FakeSq();
    fake.midiChannel = 2;
    await fake.listen();
    sq = new SqConsole("127.0.0.1", 3, { port: fake.port });
    const mutes = new Map<number, boolean>();
    let synced = false;
    sq.on("mute", (t, m) => mutes.set(t.number, m));
    sq.on("synced", () => (synced = true));
    sq.connect();

    await waitFor(() => synced);
    expect(mutes.size).toBe(48);
    expect(mutes.get(1)).toBe(true);
    expect(mutes.get(2)).toBe(false);

    fake.deskMute(7, true);
    await waitFor(() => mutes.get(7) === true);

    sq.setMute(inputTarget(1), false);
    await waitFor(() => Buffer.concat(fake.received).includes(Buffer.from("B26300B26200B20600B22600", "hex")));
  });

  it("ignores other MIDI channels", async () => {
    fake = new FakeSq();
    await fake.listen();
    sq = new SqConsole("127.0.0.1", 1, { port: fake.port });
    let synced = false;
    const mutes: number[] = [];
    sq.on("synced", () => (synced = true));
    sq.connect();
    await waitFor(() => synced);
    sq.on("mute", (t) => mutes.push(t.number));
    fake.socket?.write(encodeSqMute(1, 3, true));
    fake.deskMute(4, true);
    await waitFor(() => mutes.length === 1);
    expect(mutes).toEqual([4]);
  });

  it("syncs with what it has when some inputs don't answer", async () => {
    fake = new FakeSq();
    fake.silent.add(48);
    await fake.listen();
    sq = new SqConsole("127.0.0.1", 1, { port: fake.port, syncTimeoutMs: 200 });
    const info: string[] = [];
    let synced = false;
    sq.on("info", (m) => info.push(m));
    sq.on("synced", () => (synced = true));
    sq.connect();
    await waitFor(() => synced);
    expect(info.at(-1)).toMatch(/1 of 48/);
  });

  it("doesn't sync when nothing answers, and says to check the MIDI channel", async () => {
    fake = new FakeSq();
    fake.midiChannel = 5; // the desk is on 6, cuemute on 1
    await fake.listen();
    sq = new SqConsole("127.0.0.1", 1, { port: fake.port, syncTimeoutMs: 100 });
    const info: string[] = [];
    let synced = false;
    sq.on("info", (m) => info.push(m));
    sq.on("synced", () => (synced = true));
    sq.connect();
    await waitFor(() => info.some((m) => m.includes("MIDI channel")));
    expect(synced).toBe(false);
  });

  it("reconnects after the desk drops the link", async () => {
    fake = new FakeSq();
    await fake.listen();
    sq = new SqConsole("127.0.0.1", 1, { port: fake.port, reconnectMs: 20 });
    const states: string[] = [];
    sq.on("state", (s) => states.push(s));
    sq.connect();
    await waitFor(() => sq.state === "connected");
    fake.socket?.destroy();
    await waitFor(() => states.filter((s) => s === "connected").length === 2);
    expect(states).toEqual(["connecting", "connected", "connecting", "connected"]);
  });
});
