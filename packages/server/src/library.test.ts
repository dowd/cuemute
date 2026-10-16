import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createShow, inputTarget, newScene, type Show } from "@cuemute/core";
import { SimConsole } from "@cuemute/consoles";
import { Engine } from "./engine.ts";
import { ShowLibrary } from "./library.ts";
import { ShowStore } from "./store.ts";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("show library", () => {
  let dir: string;
  let library: ShowLibrary;
  let engine: Engine;
  let desks: number;

  const woods = (): Show => ({
    ...createShow("Into the Woods"),
    channels: [{ number: 1, name: "Ana" }],
    scenes: [
      newScene({ number: "1", changes: [{ target: inputTarget(1), muted: false }] }, "a"),
      newScene({ number: "2", changes: [{ target: inputTarget(1), muted: true }] }, "b"),
    ],
  });

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "cuemute-library-"));
    library = new ShowLibrary(dir);
    const store = new ShowStore(join(dir, "show.json"));
    store.save(createShow("First"));
    desks = 0;
    engine = new Engine({
      show: store.load(),
      save: (s) => store.save(s),
      file: "show.json",
      createConsole: () => (desks++, new SimConsole(8)),
    });
    engine.connect();
    await tick();
  });

  it("creates a show for the same desk, opens it, and saves edits to its own file", () => {
    const file = library.create(engine, "Into the Woods");
    expect(file).toBe("into-the-woods.json");
    expect(engine.snapshot().file).toBe(file);
    expect(engine.snapshot().show.name).toBe("Into the Woods");
    expect(desks).toBe(1); // same desk settings, so no reconnect
    engine.renameShow("Woods");
    expect(JSON.parse(readFileSync(join(dir, file), "utf8")).name).toBe("Woods");
    expect(JSON.parse(readFileSync(join(dir, "show.json"), "utf8")).name).toBe("First");
    expect(library.create(engine, "Into the Woods")).toBe("into-the-woods-2.json");
  });

  it("lists shows by name and skips backups and hidden files", () => {
    library.create(engine, "Annie");
    library.create(engine, "Annie");
    engine.renameShow("Annie"); // a second save writes annie-2.json.bak
    writeFileSync(join(dir, "broken.json"), "{");
    const list = library.list();
    expect(list.map((s) => s.file)).toEqual(["annie-2.json", "annie.json", "broken.json", "show.json"]);
    expect(list.find((s) => s.file === "broken.json")?.error).toBeTruthy();
    expect(list.some((s) => s.file.startsWith("."))).toBe(false);
  });

  it("starts with the most recently changed show when none was opened before", () => {
    const fresh = mkdtempSync(join(tmpdir(), "cuemute-library-"));
    const other = new ShowLibrary(fresh);
    expect(other.startPath(null)).toBe(join(fresh, "show.json"));
    new ShowStore(join(fresh, "a.json")).save(createShow("A"));
    expect(other.startPath(null)).toBe(join(fresh, "a.json"));
  });

  it("opens a show with nothing live and its first scene next, sending nothing", async () => {
    new ShowStore(join(dir, "woods.json")).save(woods());
    engine.go(); // nothing to fire in an empty show
    const sent: unknown[] = [];
    engine.console!.on("mute", (...a) => sent.push(a));
    library.open(engine, "woods.json");
    expect(engine.snapshot().cursor).toEqual({ current: null, next: "a" });
    expect(sent).toEqual([]);
    expect(library.startPath(null)).toBe(join(dir, "woods.json")); // remembered
    expect(library.startPath("/x/y.json")).toBe("/x/y.json");
  });

  it("reconnects only when the show names a different desk", () => {
    new ShowStore(join(dir, "woods.json")).save({ ...woods(), console: { type: "sim", host: "", midiChannel: 2 } });
    library.open(engine, "woods.json");
    expect(desks).toBe(2);
  });

  it("duplicates as save-as and opens the copy", () => {
    new ShowStore(join(dir, "woods.json")).save(woods());
    const file = library.duplicate(engine, "woods.json", "Woods tour");
    expect(file).toBe("woods-tour.json");
    expect(engine.snapshot().show.scenes).toHaveLength(2);
    expect(engine.snapshot().show.name).toBe("Woods tour");
  });

  it("imports a show and rejects a file that isn't one", () => {
    expect(library.import(engine, woods())).toBe("into-the-woods.json");
    expect(engine.snapshot().file).toBe("into-the-woods.json");
    expect(() => library.import(engine, { hello: 1 })).toThrow(/isn't a cuemute show/);
  });

  it("deletes a show and its backup, but not the open one", () => {
    const file = library.create(engine, "Annie");
    engine.renameShow("Annie 2"); // second save makes a .bak
    expect(existsSync(join(dir, `${file}.bak`))).toBe(true);
    expect(() => library.delete(engine, file)).toThrow(/Open another show/);
    library.open(engine, "show.json");
    library.delete(engine, file);
    expect(existsSync(join(dir, file))).toBe(false);
    expect(existsSync(join(dir, `${file}.bak`))).toBe(false);
  });

  it("refuses paths outside the folder", () => {
    expect(() => library.open(engine, "../show.json")).toThrow(/Not a show file name/);
    expect(() => library.read(".last-show")).toThrow(/Not a show file name/);
    expect(() => library.open(engine, "missing.json")).toThrow(/No such show/);
  });

  it("only changes shows in Edit mode", () => {
    engine.setMode("show");
    expect(() => library.create(engine, "Annie")).toThrow(/Edit mode/);
    expect(() => library.open(engine, "show.json")).toThrow(/Edit mode/);
    expect(library.list()).toHaveLength(1); // nothing was written
  });
});
