import { existsSync } from "node:fs";
import Fastify, { type FastifyInstance } from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { z, ZodError } from "zod";
import { channelSchema, consoleSettingsSchema, inputTarget, scenePatchSchema } from "@cuemute/core";
import { SimConsole } from "@cuemute/consoles";
import { Engine, EngineError } from "./engine.ts";

export interface HttpOptions {
  // built web UI to serve at /, if present
  webRoot?: string;
  // or the same files held in memory, keyed by path such as "assets/index.js"
  webFiles?: Map<string, Buffer>;
  logger?: boolean;
}

const idParams = z.object({ id: z.string() });
const numberParams = z.object({ number: z.coerce.number().int() });
const muteBody = z.object({ muted: z.boolean() });

export async function buildServer(engine: Engine, options: HttpOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ? { level: "warn" } : false });

  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof EngineError) return reply.status(err.status).send({ error: err.message });
    if (err instanceof ZodError) return reply.status(400).send({ error: err.issues[0]?.message ?? "Bad request" });
    app.log.error(err);
    return reply.status(500).send({ error: "Internal error" });
  });

  // --- live state over WebSocket: the server pushes a full snapshot on change ---

  await app.register(fastifyWebsocket);
  const sockets = new Set<{ send(data: string): void }>();
  let pending = false;
  engine.on("change", () => {
    // coalesce bursts, e.g. the desk reporting every channel on connect
    if (pending) return;
    pending = true;
    setImmediate(() => {
      pending = false;
      const data = JSON.stringify(engine.snapshot());
      for (const s of sockets) s.send(data);
    });
  });
  app.get("/ws", { websocket: true }, (socket) => {
    sockets.add(socket);
    socket.send(JSON.stringify(engine.snapshot()));
    socket.on("close", () => sockets.delete(socket));
  });

  // --- operation (Show and Edit mode; Companion uses these) ---

  app.get("/api/state", async () => {
    const s = engine.snapshot();
    const find = (id: string | null) => s.show.scenes.find((x) => x.id === id) ?? null;
    const label = (id: string | null) => {
      const scene = find(id);
      return scene ? [scene.number, scene.name].filter(Boolean).join(" ") : "";
    };
    // flat fields are what Companion variables read easily
    return {
      mode: s.mode,
      connected: s.connection.state === "connected",
      current: label(s.cursor.current),
      currentGroup: find(s.cursor.current)?.group ?? "",
      next: label(s.cursor.next),
      nextGroup: find(s.cursor.next)?.group ?? "",
      nextLineRef: find(s.cursor.next)?.lineRef ?? "",
      snapshot: s,
    };
  });

  app.post("/api/go", async () => ({ fired: engine.go()?.id ?? null }));
  app.post("/api/back", async () => {
    engine.back();
    return { ok: true };
  });
  app.post("/api/forward", async () => {
    engine.forward();
    return { ok: true };
  });
  app.post("/api/next/:id", async (req) => {
    engine.setNext(idParams.parse(req.params).id);
    return { ok: true };
  });
  app.post("/api/jump/:id", async (req) => ({ fired: engine.jump(idParams.parse(req.params).id).id }));
  app.post("/api/channels/:number/mute", async (req) => {
    engine.setMute(numberParams.parse(req.params).number, muteBody.parse(req.body).muted);
    return { ok: true };
  });
  app.post("/api/mode", async (req) => {
    engine.setMode(z.object({ mode: z.enum(["show", "edit"]) }).parse(req.body).mode);
    return { ok: true };
  });

  // --- programming (Edit mode) ---

  app.post("/api/record", async () => ({ scene: engine.record() }));
  app.put("/api/show/name", async (req) => {
    engine.renameShow(z.object({ name: z.string() }).parse(req.body).name);
    return { ok: true };
  });
  app.post("/api/scenes", async (req) => {
    const body = z
      .object({ afterId: z.string().nullable(), fields: scenePatchSchema.default({}) })
      .parse(req.body);
    return { scene: engine.addScene(body.afterId, body.fields) };
  });
  app.patch("/api/scenes/:id", async (req) => {
    engine.updateScene(idParams.parse(req.params).id, scenePatchSchema.parse(req.body));
    return { ok: true };
  });
  app.delete("/api/scenes/:id", async (req) => {
    engine.deleteScene(idParams.parse(req.params).id);
    return { ok: true };
  });
  app.post("/api/groups/rename", async (req) => {
    const { from, to } = z.object({ from: z.string(), to: z.string() }).parse(req.body);
    engine.renameGroup(from, to);
    return { ok: true };
  });
  app.post("/api/scenes/:id/move", async (req) => {
    const { toIndex } = z.object({ toIndex: z.number().int() }).parse(req.body);
    engine.moveScene(idParams.parse(req.params).id, toIndex);
    return { ok: true };
  });
  app.put("/api/channels", async (req) => {
    engine.setChannels(z.array(channelSchema).parse(req.body));
    return { ok: true };
  });
  app.post("/api/channels/import-names", async () => ({ imported: await engine.importChannelNames() }));
  app.put("/api/console", async (req) => {
    engine.setConsoleSettings(consoleSettingsSchema.parse(req.body));
    return { ok: true };
  });

  // a change made by hand on the simulated desk, for programming without hardware
  app.post("/api/sim/channels/:number/mute", async (req) => {
    const desk = engine.console;
    if (!(desk instanceof SimConsole)) throw new EngineError(409, "Not using the simulated desk");
    desk.deskChange(inputTarget(numberParams.parse(req.params).number), muteBody.parse(req.body).muted);
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
