import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.ts";
import { buildServer } from "./http.ts";
import { Productions } from "./productions.ts";
import { FolderStore } from "./store.ts";

// Run from the repo, productions live in the repo's productions/ folder and
// the built UI is served from packages/cuescript-web/dist.
const baseDir = resolve(fileURLToPath(import.meta.url), "../../../..");

async function main() {
  let config;
  try {
    config = loadConfig(baseDir);
  } catch (err) {
    console.error(`cuescript: ${(err as Error).message}`);
    process.exit(1);
  }
  const { host, port, productionsDir } = config;

  const productions = new Productions(new FolderStore(productionsDir));
  const app = await buildServer(productions, {
    webRoot: resolve(baseDir, "packages/cuescript-web/dist"),
    logger: true,
  });

  try {
    await app.listen({ host, port });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      console.error(`cuescript: port ${port} is in use. Is cuescript already running? If not, set CUESCRIPT_PORT.`);
    } else {
      console.error(`cuescript: can't listen on ${host}:${port}: ${(err as Error).message}`);
    }
    process.exit(1);
  }
  console.log(`cuescript: productions in ${productionsDir}`);
  console.log(`cuescript: open http://${host === "0.0.0.0" ? "localhost" : host}:${port}`);

  const shutdown = async () => {
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
