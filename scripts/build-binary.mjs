// Builds cuemute as one executable file: dist/cuemute for this machine, or
// dist/cuemute-<target> (with .exe for Windows) for another. It holds Node, the server and the web UI, so the machine that runs
// it needs nothing else installed.
//
//   npm run package                          for this machine
//   npm run package -- --target darwin-x64
//
// Targets: darwin-arm64, darwin-x64, linux-x64, linux-arm64, win-x64.
// The binary starts from the official Node build from nodejs.org, of the same
// version as the Node running this script, downloaded once into dist/node/.
// A Homebrew Node can't be the base: it loads shared libraries other machines lack.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const version = process.version;

const argIndex = process.argv.indexOf("--target");
const host = `${process.platform === "win32" ? "win" : process.platform}-${process.arch}`;
const target = argIndex > 0 ? process.argv[argIndex + 1] : host;
const targets = ["darwin-arm64", "darwin-x64", "linux-x64", "linux-arm64", "win-x64"];
if (!targets.includes(target)) fail(`unknown target "${target}". Use one of: ${targets.join(", ")}`);
const windows = target.startsWith("win");

function fail(message) {
  console.error(`build-binary: ${message}`);
  process.exit(1);
}

function run(cmd, args) {
  execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
}

// the official node binary for a target, checked against nodejs.org's SHASUMS256
async function officialNode(t) {
  const win = t.startsWith("win");
  const name = `node-${version}-${t}`;
  const archive = win ? `${name}.zip` : `${name}.tar.gz`;
  const cache = join(dist, "node", name);
  const binary = join(cache, win ? "node.exe" : "bin/node");
  if (existsSync(binary)) return binary;

  const base = `https://nodejs.org/dist/${version}`;
  console.log(`build-binary: downloading ${base}/${archive}`);
  const sums = await (await fetch(`${base}/SHASUMS256.txt`)).text();
  const expected = sums.split("\n").find((l) => l.endsWith(`  ${archive}`))?.split(" ")[0];
  if (!expected) fail(`nodejs.org has no ${archive}`);
  const res = await fetch(`${base}/${archive}`);
  if (!res.ok) fail(`can't download ${archive}: HTTP ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  if (createHash("sha256").update(data).digest("hex") !== expected) fail(`${archive} doesn't match its checksum`);

  mkdirSync(join(dist, "node"), { recursive: true });
  const file = join(dist, "node", archive);
  writeFileSync(file, data);
  run("tar", ["-xf", file, "-C", join(dist, "node")]);
  rmSync(file);
  return binary;
}

function filesUnder(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? filesUnder(path) : [path];
  });
}

const executable = await officialNode(target);
// Homebrew's Node is also built without SEA support, so the build step runs on
// the official Node for this machine
const builder = await officialNode(host);

run("npm", ["run", "build"]);
const web = join(root, "packages/web/dist");

const work = join(dist, "build");
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
const main = join(work, "cuemute.cjs");
await build({
  entryPoints: [join(root, "packages/server/src/main.ts")],
  outfile: main,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: `node${version.slice(1).split(".")[0]}`,
  // only read when run from the repo, never in the binary
  define: { "import.meta.url": '"file:///"' },
  // optional speed-ups for ws; it works without them
  external: ["bufferutil", "utf-8-validate"],
  logLevel: "warning",
});

const output = join(dist, `cuemute${target === host ? "" : `-${target}`}${windows ? ".exe" : ""}`);
const assets = Object.fromEntries(filesUnder(web).map((f) => [`web/${relative(web, f).split("\\").join("/")}`, f]));
const config = join(work, "sea-config.json");
writeFileSync(
  config,
  JSON.stringify({ main, output, executable, assets, disableExperimentalSEAWarning: true, useCodeCache: false }, null, 2),
);
run(builder, ["--build-sea", config]);

// macOS won't run a binary whose signature no longer matches; sign it ad hoc
if (target.startsWith("darwin") && process.platform === "darwin") {
  run("codesign", ["--sign", "-", "--force", output]);
}

const mb = (statSync(output).size / 1e6).toFixed(0);
console.log(`build-binary: built ${relative(root, output)} for ${target} (${mb} MB, Node ${version})`);
