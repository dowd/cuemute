import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

export interface Config {
  host: string;
  port: number;
  showPath: string;
}

const fileSchema = z.strictObject({
  host: z.string().min(1).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  show: z.string().min(1).optional(),
});

type Env = Record<string, string | undefined>;

const expandHome = (p: string) => (p === "~" || p.startsWith("~/") ? homedir() + p.slice(1) : p);

// Where the packaged binary keeps cuemute.json and shows/, per platform.
export function appDataDir(env: Env = process.env, platform: NodeJS.Platform = process.platform): string {
  if (platform === "darwin") return join(homedir(), "Library", "Application Support", "cuemute");
  if (platform === "win32") return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "cuemute");
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "cuemute");
}

// Settings come from, highest first: environment variables, the config file,
// then defaults. The config file is CUEMUTE_CONFIG, or cuemute.json in baseDir
// (the repo root, or the app data folder for the packaged binary); it is
// optional unless CUEMUTE_CONFIG names it. A relative show path in the file is
// relative to the file. The default show is shows/show.json in baseDir.
export function loadConfig(baseDir: string, env: Env = process.env): Config {
  const configPath = env.CUEMUTE_CONFIG
    ? resolve(expandHome(env.CUEMUTE_CONFIG))
    : resolve(baseDir, "cuemute.json");

  let file: z.infer<typeof fileSchema> = {};
  if (existsSync(configPath)) {
    try {
      file = fileSchema.parse(JSON.parse(readFileSync(configPath, "utf8")));
    } catch (err) {
      const detail = err instanceof z.ZodError ? z.prettifyError(err) : (err as Error).message;
      throw new Error(`Can't read the config file ${configPath}:\n${detail}`);
    }
  } else if (env.CUEMUTE_CONFIG) {
    throw new Error(`The config file ${configPath} doesn't exist`);
  }

  const port = Number(env.PORT ?? file.port ?? 4000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`PORT must be a port number, not "${env.PORT}"`);

  const showPath = env.CUEMUTE_SHOW
    ? resolve(expandHome(env.CUEMUTE_SHOW))
    : file.show
      ? resolve(dirname(configPath), expandHome(file.show))
      : resolve(baseDir, "shows/show.json");

  return { host: env.HOST ?? file.host ?? "127.0.0.1", port, showPath };
}
