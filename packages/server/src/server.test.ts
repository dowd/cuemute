import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createShow, inputTarget, newScene, type Show } from "@cuemute/core";
import { SimConsole } from "@cuemute/consoles";
import { Engine } from "./engine.ts";
import { buildServer } from "./http.ts";
import { ShowStore } from "./store.ts";

const tick = () => new Promise((r) => setTimeout(r, 0));

function showWith(): Show {
  return {
    ...createShow("Test"),
    channels: [
      { number: 1, name: "Ana" },
      { number: 2, name: "Ben" },
      { number: 3, name: "Cal" },
    ],
    scenes: [
      newScene({ number: "1", changes: [{ target: inputTarget(1), muted: false }] }, "s1"),
      newScene(
        {
          number: "2",
          changes: [
            { target: inputTarget(1), muted: true },
            { target: inputTarget(2), muted: false },
          ],
        },
        "s2",
      ),
    ],
  };
}

describe("engine with the simulated desk", () => {
  let desk: SimConsole;
  let engine: Engine;
  let saved: Show[];

  beforeEach(async () => {
    desk = new SimConsole(8);
    saved = [];
    engine = new Engine({ show: showWith(), save: (s) => saved.push(s), createConsole: () => desk });
    engine.connect();
    await tick();
  });

  it("reads the desk on connect", () => {
    const s = engine.snapshot();
    expect(s.connection).toMatchObject({ state: "connected", synced: true });
    expect(s.live["input:1"]).toBe(true);
  });

  it("GO fires scenes in order and touches only the channels they list", () => {
    desk.deskChange(inputTarget(5), false); // the band, by hand
    engine.go();
    expect(desk.isMuted(inputTarget(1))).toBe(false);
    engine.go();
    expect(desk.isMuted(inputTarget(1))).toBe(true);
    expect(desk.isMuted(inputTarget(2))).toBe(false);
    expect(desk.isMuted(inputTarget(5))).toBe(false); // untouched
    expect(engine.snapshot().cursor).toEqual({ current: "s2", next: null });
  });

  it("refuses GO while the desk is disconnected and keeps the cursor", () => {
    engine.disconnect();
    expect(() => engine.go()).toThrow("Desk not connected");
    expect(engine.snapshot().cursor.next).toBe("s1");
  });

  it("records the changes made on the desk since the last GO", () => {
    engine.go(); // s1: Ana open
    desk.deskChange(inputTarget(3), false); // Cal opened by hand
    desk.deskChange(inputTarget(7), false); // not a show channel
    const scene = engine.record();
    expect(scene.changes).toEqual([{ target: inputTarget(3), muted: false }]);
    expect(engine.snapshot().show.scenes.map((s) => s.id)).toEqual(["s1", scene.id, "s2"]);
    expect(saved.length).toBe(1);
  });

  it("blocks editing in Show mode but still runs the show", () => {
    engine.setMode("show");
    expect(() => engine.addScene(null, {})).toThrow("Edit mode");
    expect(() => engine.go()).not.toThrow();
  });
});

describe("HTTP API", () => {
  let engine: Engine;
  let app: Awaited<ReturnType<typeof buildServer>>;

  beforeEach(async () => {
    engine = new Engine({ show: showWith(), save: () => {}, createConsole: () => new SimConsole(8) });
    engine.connect();
    await tick();
    app = await buildServer(engine);
  });
  afterEach(() => app.close());

  it("GO, Back and state for Companion", async () => {
    let res = await app.inject({ method: "POST", url: "/api/go" });
    expect(res.json()).toEqual({ fired: "s1" });
    res = await app.inject({ method: "GET", url: "/api/state" });
    expect(res.json()).toMatchObject({ current: "1", next: "2", connected: true });
    await app.inject({ method: "POST", url: "/api/back" });
    res = await app.inject({ method: "GET", url: "/api/state" });
    expect(res.json().next).toBe("1");
  });

  it("mutes one channel", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/channels/2/mute",
      payload: { muted: false },
    });
    expect(res.statusCode).toBe(200);
    expect(engine.snapshot().live["input:2"]).toBe(false);
  });

  it("reports errors with a status and message", async () => {
    let res = await app.inject({ method: "POST", url: "/api/jump/nope" });
    expect(res.statusCode).toBe(404);
    res = await app.inject({ method: "POST", url: "/api/channels/99/mute", payload: { muted: true } });
    expect(res.statusCode).toBe(400);
    res = await app.inject({ method: "POST", url: "/api/channels/1/mute", payload: { muted: "yes" } });
    expect(res.statusCode).toBe(400);
  });

  it("edits scenes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/scenes",
      payload: { afterId: "s1", fields: { number: "1A", name: "Entrance" } },
    });
    const id = res.json().scene.id;
    await app.inject({ method: "PATCH", url: `/api/scenes/${id}`, payload: { lineRef: "p3" } });
    const scene = engine.snapshot().show.scenes[1];
    expect(scene).toMatchObject({ id, number: "1A", name: "Entrance", lineRef: "p3" });
  });

  it("changes the desk on the simulator by hand", async () => {
    await app.inject({ method: "POST", url: "/api/sim/channels/4/mute", payload: { muted: false } });
    expect(engine.snapshot().live["input:4"]).toBe(false);
  });
});

describe("ShowStore", () => {
  it("creates a new show, then saves with a backup", () => {
    const dir = mkdtempSync(join(tmpdir(), "cuemute-"));
    const store = new ShowStore(join(dir, "shows", "a.json"));
    const show = store.load();
    expect(show.scenes).toEqual([]);
    store.save(show);
    store.save({ ...show, name: "Second" });
    expect(store.load().name).toBe("Second");
    expect(JSON.parse(readFileSync(`${store.path}.bak`, "utf8")).name).toBe(show.name);
    expect(existsSync(`${store.path}.tmp`)).toBe(false);
  });
});
