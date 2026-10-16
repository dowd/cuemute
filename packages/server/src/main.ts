import { networkInterfaces } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isSea } from "node:sea";
import { createConsole } from "@cuemute/consoles";
import { Engine } from "./engine.ts";
import { appDataDir, loadConfig } from "./config.ts";
import { buildServer } from "./http.ts";
import { embeddedWebFiles } from "./embedded.ts";
import { ShowStore } from "./store.ts";

// Run from the repo, the settings, the show and the built UI live in the repo.
// The packaged binary keeps settings and shows in the app data folder and
// serves the UI it carries. Configuration: see loadConfig and the README.
const packaged = isSea();
const baseDir = packaged ? appDataDir() : resolve(fileURLToPath(import.meta.url), "../../../..");
// a function, not top-level await, so the packaged CommonJS bundle can run it
async function main() {
  let config;
  try {
    config = loadConfig(baseDir);
  } catch (err) {
    console.error(`cuemute: ${(err as Error).message}`);
    process.exit(1);
  }
  const { host, port, showPath } = config;

  const store = new ShowStore(showPath);
  const engine = new Engine({ show: store.load(), save: (s) => store.save(s), createConsole });
  const app = await buildServer(engine, {
    ...(packaged ? { webFiles: embeddedWebFiles() } : { webRoot: resolve(baseDir, "packages/web/dist") }),
    logger: true,
  });

  try {
    await app.listen({ host, port });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRNOTAVAIL") {
      const own = Object.entries(networkInterfaces()).flatMap(([name, addrs]) =>
        (addrs ?? []).filter((a) => a.family === "IPv4").map((a) => `  ${a.address} (${name})`),
      );
      console.error(`cuemute: this Mac has no address ${host}. Set host to one of:\n${own.join("\n")}`);
    } else if (code === "EADDRINUSE") {
      console.error(`cuemute: port ${port} is in use. Is cuemute already running? If not, set a different port.`);
    } else {
      console.error(`cuemute: can't listen on ${host}:${port}: ${(err as Error).message}`);
    }
    process.exit(1);
  }
  if (packaged) console.log(`cuemute: settings in ${baseDir}`);
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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
