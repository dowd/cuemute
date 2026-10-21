import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { z, ZodError } from "zod";
import { afterIdFor, productionView, quoteAt, type LinkedScene } from "@cuemute/script";
import { readScript, ScriptImportError } from "@cuemute/script/import";
import { cuemuteApi, cuemuteOrigin } from "./link.ts";
import { Links } from "./links.ts";
import { HttpError, type Productions } from "./productions.ts";

export interface HttpOptions {
  // built web UI to serve at /, if present
  webRoot?: string;
  // or the same files held in memory, keyed by path such as "assets/index.js"
  webFiles?: Map<string, Buffer>;
  logger?: boolean;
}

const idParams = z.object({ id: z.string() });
const nameBody = z.object({ name: z.string() });
const wordBody = z.object({ paragraph: z.string(), word: z.number().int() });
const MAX_FILE = 20 * 1024 * 1024;

// Every change is one small HTTP request; each production's WebSocket only
// pushes its state back. Accounts, when they come, check requests here.
export async function buildServer(productions: Productions, options: HttpOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ? { level: "warn" } : false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    if (err instanceof ScriptImportError) return reply.status(400).send({ error: err.message });
    if (err instanceof ZodError) return reply.status(400).send({ error: err.issues[0]?.message ?? "Bad request" });
    if ((err as { statusCode?: number }).statusCode === 413) return reply.status(413).send({ error: "That file is too big" });
    app.log.error(err);
    return reply.status(500).send({ error: "Internal error" });
  });

  // a script file comes as the body itself; its name comes in the query
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: MAX_FILE }, (_req, body, done) =>
    done(null, body),
  );

  // --- live state: each screen watches one production ---

  await app.register(fastifyWebsocket);
  const watchers = new Map<string, Set<{ send(data: string): void }>>();
  const links = new Links(productions);
  app.addHook("onClose", async () => links.closeAll());
  links.on("state", (id, state) => {
    const data = JSON.stringify({ link: state });
    for (const s of watchers.get(id) ?? []) s.send(data);
  });
  productions.on("change", (id) => {
    const sockets = watchers.get(id);
    if (!sockets) return;
    const data = JSON.stringify({ production: productionView(productions.get(id)) });
    for (const s of sockets) s.send(data);
  });
  productions.on("deleted", (id) => {
    for (const s of watchers.get(id) ?? []) s.send(JSON.stringify({ deleted: true }));
  });
  app.get("/ws/productions/:id", { websocket: true }, (socket, req) => {
    const { id } = idParams.parse(req.params);
    let view;
    try {
      view = productionView(productions.get(id));
    } catch (err) {
      socket.send(JSON.stringify({ error: err instanceof Error ? err.message : "No such production" }));
      socket.close();
      return;
    }
    const sockets = watchers.get(id) ?? new Set();
    watchers.set(id, sockets);
    sockets.add(socket);
    socket.send(JSON.stringify({ production: view }));
    links.watch(id);
    socket.send(JSON.stringify({ link: links.state(id) }));
    socket.on("close", () => {
      sockets.delete(socket);
      if (sockets.size === 0) watchers.delete(id);
      links.unwatch(id);
    });
  });

  // --- the library ---

  app.get("/api/productions", async () => ({ productions: productions.list() }));
  app.post("/api/productions", async (req) => ({ id: productions.create(nameBody.parse(req.body).name).id }));
  app.post("/api/productions/import", { bodyLimit: MAX_FILE }, async (req) => ({ id: productions.import(req.body).id }));

  // --- one production ---

  app.get("/api/productions/:id", async (req) => productionView(productions.get(idParams.parse(req.params).id)));
  app.put("/api/productions/:id/name", async (req) => {
    productions.rename(idParams.parse(req.params).id, nameBody.parse(req.body).name);
    return { ok: true };
  });
  app.delete("/api/productions/:id", async (req) => {
    productions.delete(idParams.parse(req.params).id);
    return { ok: true };
  });
  app.get("/api/productions/:id/export", async (req, reply) => {
    const p = productions.get(idParams.parse(req.params).id);
    const file = `${p.name.replace(/[^\w -]+/g, "").trim() || "production"}.cuescript.json`;
    return reply
      .header("content-disposition", `attachment; filename="${file}"`)
      .type("application/json")
      .send(`${JSON.stringify(p, null, 2)}\n`);
  });

  app.get("/api/productions/:id/script", async (req) => ({
    script: productions.get(idParams.parse(req.params).id).script,
  }));
  app.put("/api/productions/:id/script", { bodyLimit: MAX_FILE }, async (req) => {
    const { id } = idParams.parse(req.params);
    const { name } = z.object({ name: z.string().default("script") }).parse(req.query);
    if (!Buffer.isBuffer(req.body)) throw new HttpError(400, "Send the script file as application/octet-stream");
    productions.get(id); // a missing production is a 404 before the file is read
    const script = readScript(req.body, name);
    const kept = productions.setScript(id, script);
    // scenes whose lines moved or were cut try again by their Line / cue
    const state = links.state(id);
    const placed = state.status === "connected" ? productions.autoPlace(id, state.scenes) : 0;
    return { paragraphs: script.paragraphs.length, cues: kept + placed };
  });

  // --- the link to cuemute, and mute cues ---

  // the linked cuemute's scenes, or an error saying why there are none
  const connected = (id: string): LinkedScene[] => {
    const state = links.state(id);
    if (!productions.get(id).link) throw new HttpError(409, "Link to cuemute first");
    if (state.status !== "connected") throw new HttpError(409, state.message || "Not connected to cuemute");
    return state.scenes;
  };

  // links to the cuemute at an address, and to the show it has open now
  app.put("/api/productions/:id/link", async (req) => {
    const { id } = idParams.parse(req.params);
    productions.get(id);
    const url = cuemuteOrigin(z.object({ url: z.string() }).parse(req.body).url);
    const { snapshot } = await cuemuteApi<{ snapshot: { file: string | null; show: { name: string; scenes: LinkedScene[] } } }>(
      url,
      "GET",
      "/state",
    );
    productions.setLink(id, { url, show: snapshot.file ?? "" });
    const placed = productions.autoPlace(id, snapshot.show.scenes);
    return { show: snapshot.show.name, placed };
  });
  app.delete("/api/productions/:id/link", async (req) => {
    productions.setLink(idParams.parse(req.params).id, null);
    return { ok: true };
  });

  // places every scene that isn't placed yet by its Line / cue
  app.post("/api/productions/:id/cues/auto", async (req) => {
    const { id } = idParams.parse(req.params);
    return { placed: productions.autoPlace(id, connected(id)) };
  });

  // places a cuemute scene at a word, or moves it there. A scene with no Line /
  // cue gets the words that end at the cue, if cuemute is in Edit mode.
  app.put("/api/productions/:id/cues/scene/:scene", async (req) => {
    const { id, scene: sceneId } = z.object({ id: z.string(), scene: z.string() }).parse(req.params);
    const scene = connected(id).find((s) => s.id === sceneId);
    if (!scene) throw new HttpError(404, "cuemute has no such scene");
    const cue = productions.placeScene(id, scene, wordBody.parse(req.body));
    if (!scene.lineRef.trim() && links.state(id).mode === "edit") {
      await cuemuteApi(productions.get(id).link!.url, "PATCH", `/scenes/${encodeURIComponent(scene.id)}`, {
        lineRef: cue.at.quote,
      }).catch(() => {});
    }
    return { cue };
  });

  // adds a scene to cuemute at a word, in script order, and places it there
  app.post("/api/productions/:id/cues/new-scene", async (req) => {
    const { id } = idParams.parse(req.params);
    const scenes = connected(id);
    const at = wordBody.parse(req.body);
    const position = productions.position(id, at);
    const p = productions.get(id);
    const cueOf = new Map(p.cues.map((c) => [c.scene, c]));
    const paragraphIndex = new Map(p.script!.paragraphs.map((x, i) => [x.id, i]));
    const afterId = afterIdFor(
      scenes,
      (s) => {
        const cue = cueOf.get(s.id);
        const index = cue ? paragraphIndex.get(cue.at.paragraph) : undefined;
        return cue && index !== undefined ? { index, word: cue.at.word } : null;
      },
      position,
    );
    const lineRef = quoteAt(p.script!.paragraphs[position.index]!, position.word);
    const { scene } = await cuemuteApi<{ scene: LinkedScene }>(p.link!.url, "POST", "/scenes", { afterId, fields: { lineRef } });
    return { cue: productions.placeScene(id, scene, at) };
  });

  app.delete("/api/productions/:id/cues/:cue", async (req) => {
    const { id, cue } = z.object({ id: z.string(), cue: z.string() }).parse(req.params);
    productions.removeCue(id, cue);
    return { ok: true };
  });

  if (options.webRoot && existsSync(options.webRoot)) {
    await app.register(fastifyStatic, { root: options.webRoot });
  } else if (options.webFiles) {
    const files = options.webFiles;
    app.get("/*", async (req, reply) => {
      const path = req.url.split("?")[0]!.slice(1) || "index.html";
      const body = files.get(path);
      if (!body) return reply.status(404).send({ error: "Not found" });
      return reply.type(contentType(path)).send(body);
    });
  }

  return app;
}

const TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  ico: "image/x-icon",
  json: "application/json",
};

const contentType = (path: string) => TYPES[path.split(".").pop() ?? ""] ?? "application/octet-stream";
