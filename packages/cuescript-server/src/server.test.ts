import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { createProduction } from "@cuemute/script";
import { buildServer } from "./http.ts";
import { Productions } from "./productions.ts";
import { FolderStore } from "./store.ts";

describe("FolderStore", () => {
  let dir: string;
  let store: FolderStore;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cuescript-"));
    store = new FolderStore(dir);
  });

  it("saves one file per production, keeping the version before as .bak", () => {
    const p = createProduction("Beauty and the Beast", "p1");
    store.save(p);
    store.save({ ...p, name: "Beauty" });
    expect(store.load("p1")!.name).toBe("Beauty");
    expect(JSON.parse(readFileSync(join(dir, "p1.json.bak"), "utf8")).name).toBe("Beauty and the Beast");
    expect(store.list()).toMatchObject([{ id: "p1", name: "Beauty", script: null }]);
  });

  it("leaves damaged files out of the list, and refuses ids that are paths", () => {
    store.save(createProduction("Good", "good"));
    writeFileSync(join(dir, "bad.json"), "{nope");
    expect(store.list().map((p) => p.id)).toEqual(["good"]);
    expect(() => store.load("bad")).toThrow();
    expect(store.load("../good")).toBeNull();
  });

  it("deletes a production and its backup", () => {
    const p = createProduction("Gone", "gone");
    store.save(p);
    store.save(p);
    store.delete("gone");
    expect(existsSync(join(dir, "gone.json"))).toBe(false);
    expect(existsSync(join(dir, "gone.json.bak"))).toBe(false);
  });
});

describe("HTTP API", () => {
  let productions: Productions;
  let app: Awaited<ReturnType<typeof buildServer>>;
  beforeEach(async () => {
    productions = new Productions(new FolderStore(mkdtempSync(join(tmpdir(), "cuescript-"))));
    app = await buildServer(productions);
  });

  const create = async (name = "Panto") =>
    (await app.inject({ method: "POST", url: "/api/productions", payload: { name } })).json().id as string;
  const uploadScript = (id: string, text: string, name = "script.txt") =>
    app.inject({
      method: "PUT",
      url: `/api/productions/${id}/script?name=${name}`,
      headers: { "content-type": "application/octet-stream" },
      payload: Buffer.from(text),
    });

  it("creates, lists and renames productions", async () => {
    const id = await create("Panto");
    await app.inject({ method: "PUT", url: `/api/productions/${id}/name`, payload: { name: "Beauty and the Beast" } });
    const list = (await app.inject({ method: "GET", url: "/api/productions" })).json().productions;
    expect(list).toMatchObject([{ id, name: "Beauty and the Beast", script: null }]);
  });

  it("imports a script, and sends screens its size, not its text", async () => {
    const id = await create();
    const changes: string[] = [];
    productions.on("change", (x) => changes.push(x));
    const res = await uploadScript(id, "# ACT 1\nFELIX. Hello\n");
    expect(res.json()).toEqual({ paragraphs: 2, cues: 0 });
    expect(changes).toEqual([id]);
    const view = (await app.inject({ method: "GET", url: `/api/productions/${id}` })).json();
    expect(view.script).toMatchObject({ name: "script.txt", paragraphs: 2 });
    expect(view.script.paragraphs).toBe(2);
    const script = (await app.inject({ method: "GET", url: `/api/productions/${id}/script` })).json().script;
    expect(script.paragraphs[1].runs).toEqual([{ text: "FELIX. Hello" }]);
  });

  it("refuses an empty script and a missing production", async () => {
    const id = await create();
    expect((await uploadScript(id, "\n\n")).json()).toEqual({ error: "script.txt has no text" });
    expect((await uploadScript("nope", "x")).statusCode).toBe(404);
    expect((await app.inject({ method: "GET", url: "/api/productions/nope" })).statusCode).toBe(404);
  });

  it("exports a production, and imports it back as a new one", async () => {
    const id = await create("Panto");
    await uploadScript(id, "Hello");
    const file = await app.inject({ method: "GET", url: `/api/productions/${id}/export` });
    expect(file.headers["content-disposition"]).toBe('attachment; filename="Panto.cuescript.json"');
    const res = await app.inject({ method: "POST", url: "/api/productions/import", payload: file.json() });
    const copy = res.json().id as string;
    expect(copy).not.toBe(id);
    const view = (await app.inject({ method: "GET", url: `/api/productions/${copy}` })).json();
    expect(view).toMatchObject({ name: "Panto", script: { paragraphs: 1 } });
    const bad = await app.inject({ method: "POST", url: "/api/productions/import", payload: { hello: 1 } });
    expect(bad.json().error).toBe("That file isn't a cuescript production, or it is damaged");
  });

  it("deletes a production", async () => {
    const id = await create();
    const deleted: string[] = [];
    productions.on("deleted", (x) => deleted.push(x));
    await app.inject({ method: "DELETE", url: `/api/productions/${id}` });
    expect(deleted).toEqual([id]);
    expect((await app.inject({ method: "GET", url: `/api/productions/${id}` })).statusCode).toBe(404);
  });
});
