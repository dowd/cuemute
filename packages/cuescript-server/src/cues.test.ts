import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { defaultDepartments, parseProduction } from "@cuemute/script";
import { buildServer } from "./http.ts";
import { Productions } from "./productions.ts";
import { FolderStore } from "./store.ts";

const SCRIPT = "# SCENE 1\nFELIX. I will 'ave to 'ide!\nJACQUES. Felix!\nCAPUCINE. Hello there.\n";

describe("department cues and notes", () => {
  let app: Awaited<ReturnType<typeof buildServer>>;
  let id: string;
  let para: (start: string) => string;

  const call = async (method: string, url: string, payload?: unknown) => {
    const res = await app.inject({ method: method as "GET", url: `/api/productions/${id}${url}`, payload: payload as object });
    return { status: res.statusCode, body: res.json() as Record<string, any> };
  };
  const upload = (text: string) =>
    app.inject({
      method: "PUT",
      url: `/api/productions/${id}/script?name=s.txt`,
      headers: { "content-type": "application/octet-stream" },
      payload: Buffer.from(text),
    });

  beforeEach(async () => {
    app = await buildServer(new Productions(new FolderStore(mkdtempSync(join(tmpdir(), "cuescript-")))));
    id = (await app.inject({ method: "POST", url: "/api/productions", payload: { name: "Panto" } })).json().id;
    await upload(SCRIPT);
    const script = (await call("GET", "/script")).body.script;
    para = (start) => script.paragraphs.find((p: any) => p.runs[0].text.startsWith(start)).id;
  });

  it("starts with the default departments", async () => {
    const p = (await call("GET", "")).body;
    expect(p.departments.map((d: any) => d.code)).toEqual(["", "LX", "SFX", "FLY", "SM"]);
    expect(p.notes).toEqual([]);
  });

  it("adds, changes, moves and deletes a cue", async () => {
    let r = await call("POST", "/cues", { department: "lx", number: "14", label: "Blackout", at: { paragraph: para("FELIX"), word: 5 } });
    const cue = r.body.cue;
    expect(cue).toMatchObject({ kind: "cue", department: "lx", number: "14", label: "Blackout", notes: "" });
    expect(cue.at.quote).toBe("I will 'ave to 'ide!");

    await call("PATCH", `/cues/${cue.id}`, { number: "14.5", notes: "Slow" });
    await call("PATCH", `/cues/${cue.id}`, { at: { paragraph: para("CAPUCINE"), word: 2 } });
    let p = (await call("GET", "")).body;
    expect(p.cues[0]).toMatchObject({ number: "14.5", notes: "Slow", label: "Blackout", at: { quote: "Hello there." } });

    r = await call("PATCH", `/cues/${cue.id}`, { department: "nope" });
    expect(r.body.error).toBe("No such department");
    r = await call("PATCH", `/cues/${cue.id}`, { kind: "mute" });
    expect(r.status).toBe(400);

    await call("DELETE", `/cues/${cue.id}`);
    p = (await call("GET", "")).body;
    expect(p.cues).toEqual([]);
  });

  it("refuses mute cues and words that aren't there", async () => {
    let r = await call("POST", "/cues", { department: "mutes", at: { paragraph: para("FELIX"), word: 0 } });
    expect(r.body.error).toBe("Mute cues come from cuemute's scenes");
    r = await call("POST", "/cues", { department: "lx", at: { paragraph: para("FELIX"), word: 99 } });
    expect(r.body.error).toBe("No such word in the script");
  });

  it("adds, changes and deletes a note", async () => {
    const { note } = (await call("POST", "/notes", { text: "Check mic 3", at: { paragraph: para("JACQUES"), word: 1 } })).body;
    await call("PATCH", `/notes/${note.id}`, { text: "Check mic 4" });
    expect((await call("GET", "")).body.notes).toMatchObject([{ text: "Check mic 4", at: { quote: "Felix!" } }]);
    await call("DELETE", `/notes/${note.id}`);
    expect((await call("GET", "")).body.notes).toEqual([]);
  });

  it("keeps the mutes department, and a department with cues", async () => {
    await call("POST", "/cues", { department: "lx", at: { paragraph: para("FELIX"), word: 1 } });
    const lxOnly = defaultDepartments().filter((d) => d.id !== "sfx");
    expect((await call("PUT", "/departments", lxOnly)).status).toBe(200);
    let r = await call("PUT", "/departments", lxOnly.filter((d) => d.id !== "lx"));
    expect(r.body.error).toBe("Lighting has 1 cue. Delete them first.");
    r = await call("PUT", "/departments", lxOnly.filter((d) => d.id !== "mutes"));
    expect(r.body.error).toBe("The mutes department can't be removed");
    r = await call("PUT", "/departments", [...lxOnly, { id: "pyro", name: "Pyro", code: "PY", colour: "#ff0000" }]);
    expect((await call("GET", "")).body.departments.at(-1).code).toBe("PY");
  });

  it("finds cues and notes again in a new script version, and keeps the lost ones unplaced", async () => {
    await call("POST", "/cues", { department: "lx", number: "1", at: { paragraph: para("FELIX"), word: 5 } });
    await call("POST", "/cues", { department: "sfx", number: "2", at: { paragraph: para("CAPUCINE"), word: 2 } });
    await call("POST", "/notes", { text: "Mic 3", at: { paragraph: para("JACQUES"), word: 1 } });
    const r = await upload(`NEW LINE.\n${SCRIPT.replace("Hello there.", "Goodbye.")}`);
    expect(r.json()).toEqual({ paragraphs: 5, cues: 1 });
    const p = (await call("GET", "")).body;
    expect(p.cues.map((c: any) => [c.number, c.at?.quote ?? null])).toEqual([
      ["1", "I will 'ave to 'ide!"],
      ["2", null],
    ]);
    expect(p.notes[0].at.quote).toBe("Felix!");
  });
});

describe("production files", () => {
  it("from before departments and notes load with the defaults", () => {
    const p = parseProduction({ schemaVersion: 1, id: "old", name: "Old", script: null, link: null, cues: [] });
    expect(p.departments).toEqual(defaultDepartments());
    expect(p.notes).toEqual([]);
  });
});
