import { homedir } from "node:os";
import { join, resolve } from "node:path";

export interface Config {
  host: string;
  port: number;
  // the folder of production files
  productionsDir: string;
}

type Env = Record<string, string | undefined>;

const expandHome = (p: string) => (p === "~" || p.startsWith("~/") ? homedir() + p.slice(1) : p);

// Where the packaged binary keeps its productions, per platform.
export function appDataDir(env: Env = process.env, platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") return join(homedir(), "Library", "Application Support", "cuescript");
  if (platform === "win32") return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "cuescript");
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "cuescript");
}

// Settings come from environment variables, then defaults. They have their own
// names, so cuescript and cuemute can run side by side from one shell.
export function loadConfig(baseDir: string, env: Env = process.env): Config {
  const port = Number(env.CUESCRIPT_PORT ?? 4001);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`CUESCRIPT_PORT must be a port number, not "${env.CUESCRIPT_PORT}"`);
  }
  return {
    host: env.CUESCRIPT_HOST ?? "127.0.0.1",
    port,
    productionsDir: env.CUESCRIPT_PRODUCTIONS
      ? resolve(expandHome(env.CUESCRIPT_PRODUCTIONS))
      : resolve(baseDir, "productions"),
  };
}
