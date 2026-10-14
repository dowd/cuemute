import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createConsole } from "@cuemute/consoles";
import { Engine } from "./engine.ts";
import { loadConfig } from "./config.ts";
import { buildServer } from "./http.ts";
import { ShowStore } from "./store.ts";

// Configuration: see loadConfig and the README.
const repoRoot = resolve(fileURLToPath(import.meta.url), "../../../..");
let config;
try {
  config = loadConfig(repoRoot);
} catch (err) {
  console.error(`cuemute: ${(err as Error).message}`);
  process.exit(1);
}
const { host, port, showPath } = config;

const store = new ShowStore(showPath);
const engine = new Engine({ show: store.load(), save: (s) => store.save(s), createConsole });
const app = await buildServer(engine, {
  webRoot: resolve(repoRoot, "packages/web/dist"),
  logger: true,
});

await app.listen({ host, port });
console.log(`cuemute: show file ${showPath}`);
console.log(`cuemute: open http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);
engine.connect();

const shutdown = async () => {
  engine.disconnect();
  await app.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
