import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { createShow, newScene } from "@cuemute/core";
import { SimConsole } from "@cuemute/consoles";
import { Engine } from "../../server/src/engine.ts";
import { buildServer as buildCuemute } from "../../server/src/http.ts";
import type { LinkState, ProductionView } from "@cuemute/script";
import { buildServer } from "./http.ts";
import { Productions } from "./productions.ts";
import { FolderStore } from "./store.ts";

const SCRIPT = [
  "# SCENE 1",
  "JACQUES. (calling off) Felix!",
  "FELIX. I will 'ave to 'ide! (He sits on the bench.)",
  "JACQUES. Felix!",
  "CAPUCINE. Hello.",
  "FELIX. I need shoes. Dog shoes!",
].join("\n");

// a real cuemute on the simulated desk, with the show file "panto.json" open
async function startCuemute() {
  const show = {
    ...createShow("Panto"),
    scenes: [
      newScene({ number: "10", name: "Hide", lineRef: "I will 'ave to 'ide!" }, "s10"),
      newScene({ number: "12", name: "Capucine", lineRef: "Felix!" }, "s12"),
      newScene({ number: "15", name: "Shoes", lineRef: "Dog shoes!" }, "s15"),
      newScene({ number: "16", name: "After song", lineRef: "After song" }, "s16"),
    ],
  };
  const engine = new Engine({ show, save: () => {}, file: "panto.json", createConsole: () => new SimConsole(8) });
  engine.connect();
  const app = await buildCuemute(engine);
  await app.listen({ host: "127.0.0.1", port: 0 });
  const { port } = app.server.address() as { port: number };
  return { engine, app, url: `http://127.0.0.1:${port}` };
}

describe("the link to cuemute", () => {
  let cuemute: Awaited<ReturnType<typeof startCuemute>>;
  let app: FastifyInstance;
  let base: string;
  let id: string;

  beforeEach(async () => {
    cuemute = await startCuemute();
    app = await buildServer(new Productions(new FolderStore(mkdtempSync(join(tmpdir(), "cuescript-")))));
    await app.listen({ host: "127.0.0.1", port: 0 });
    base = `http://127.0.0.1:${(app.server.address() as { port: number }).port}`;
    id = (await call("POST", "/productions", { name: "Panto" })).id;
    await fetch(`${base}/api/productions/${id}/script?name=s.txt`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: SCRIPT,
    });
  });

  afterEach(async () => {
    await app.close();
    await cuemute.app.close();
  });

  async function call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${base}/api${path}`, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return (await res.json()) as Record<string, any>;
  }

  // a screen watching the production, which also opens the link
  function watch() {
    const socket = new WebSocket(`${base.replace("http", "ws")}/ws/productions/${id}`);
    const seen: { link?: LinkState; production?: ProductionView }[] = [];
    socket.onmessage = (e) => seen.push(JSON.parse(String(e.data)));
    const until = async (test: (s: LinkState) => boolean) => {
      for (let i = 0; i < 100; i++) {
        const link = seen.findLast((m) => m.link)?.link;
        if (link && test(link)) return link;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error(`link never got there: ${JSON.stringify(seen.findLast((m) => m.link))}`);
    };
    return { socket, until };
  }

  it("links, and places each scene on the last word of its Line / cue, settling repeats by order", async () => {
    const r = await call("PUT", `/productions/${id}/link`, { url: cuemute.url.replace("http://", "") });
    expect(r).toEqual({ show: "Panto", placed: 3 });
    const p = await call("GET", `/productions/${id}`);
    expect(p.link).toEqual({ url: cuemute.url, show: "panto.json" });
    const at = Object.fromEntries(p.cues.map((c: any) => [c.number, c.at.quote]));
    // "Felix!" is between scene 10 and 15, so the JACQUES line after 'ide
    expect(at).toEqual({ "10": "I will 'ave to 'ide!", "12": "Felix!", "15": "I need shoes. Dog shoes!" });
  });

  it("follows cuemute's live and next scenes, and its renumbering", async () => {
    await call("PUT", `/productions/${id}/link`, { url: cuemute.url });
    const screen = watch();
    let link = await screen.until((s) => s.status === "connected");
    expect(link).toMatchObject({ mode: "edit", current: null, next: "s10" });
    cuemute.engine.go();
    link = await screen.until((s) => s.next === "s12");
    expect(link.current).toBe("s10");
    cuemute.engine.updateScene("s12", { number: "12A" });
    for (let i = 0; i < 50 && (await call("GET", `/productions/${id}`)).cues.every((c: any) => c.number !== "12A"); i++) {
      await new Promise((r) => setTimeout(r, 20));
    }
    expect((await call("GET", `/productions/${id}`)).cues.map((c: any) => c.number)).toContain("12A");
    screen.socket.close();
  });

  it("says when cuemute has another show open", async () => {
    await call("PUT", `/productions/${id}/link`, { url: cuemute.url });
    const screen = watch();
    await screen.until((s) => s.status === "connected");
    cuemute.engine.openShow(createShow("Other"), () => {}, "other.json");
    const link = await screen.until((s) => s.status === "other-show");
    expect(link.message).toBe(`cuemute has "Other" open, not this production's show (panto.json)`);
    screen.socket.close();
  });

  it("places a scene by hand, and adds a new scene to cuemute in script order", async () => {
    await call("PUT", `/productions/${id}/link`, { url: cuemute.url });
    const screen = watch();
    await screen.until((s) => s.status === "connected");
    const script = (await call("GET", `/productions/${id}/script`)).script;
    const hello = script.paragraphs.find((x: any) => x.runs[0].text.startsWith("CAPUCINE")).id;

    let r = await call("PUT", `/productions/${id}/cues/scene/s16`, { paragraph: hello, word: 1 });
    expect(r.cue).toMatchObject({ scene: "s16", number: "16", at: { word: 1, quote: "Hello." } });

    // "will" comes before scene 10's cue on "'ide!" in the same line, so the new scene goes first
    const hide = script.paragraphs.find((x: any) => x.runs[0].text.startsWith("FELIX. I will")).id;
    r = await call("POST", `/productions/${id}/cues/new-scene`, { paragraph: hide, word: 2 });
    const scenes = cuemute.engine.snapshot().show.scenes;
    expect(scenes.map((s) => s.id).indexOf(r.cue.scene)).toBe(0);
    expect(scenes[0]!.lineRef).toBe("I will");

    cuemute.engine.setMode("show");
    await screen.until((s) => s.mode === "show");
    r = await call("POST", `/productions/${id}/cues/new-scene`, { paragraph: hide, word: 2 });
    expect(r.error).toBe("Switch cuemute to Edit mode to change its scenes");
    screen.socket.close();
  });

  it("finds cues again in a new version of the script", async () => {
    await call("PUT", `/productions/${id}/link`, { url: cuemute.url });
    const revised = `NEW OPENING LINE.\n${SCRIPT.replace("Dog shoes!", "Some new words.")}`;
    const res = await fetch(`${base}/api/productions/${id}/script?name=s2.txt`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: revised,
    });
    // 10 and 12 move down a line; 15's line changed, and nothing is watching to retry it
    expect(await res.json()).toEqual({ paragraphs: 7, cues: 2 });
    const p = await call("GET", `/productions/${id}`);
    expect(p.cues.map((c: any) => c.number).sort()).toEqual(["10", "12"]);
  });

  it("refuses a cuemute it can't reach, and placing while unlinked", async () => {
    let r = await call("PUT", `/productions/${id}/link`, { url: "127.0.0.1:1" });
    expect(r.error).toBe("Can't reach cuemute at http://127.0.0.1:1");
    r = await call("POST", `/productions/${id}/cues/auto`);
    expect(r.error).toBe("Link to cuemute first");
  });
});
