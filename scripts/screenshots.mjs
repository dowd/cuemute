// Takes the screenshots in docs/images from the demo shows in docs/demo.
// It runs cuemute on a temporary show library with the simulated desk, and
// drives your installed Google Chrome. Run it after UI changes:
//
//   npm run screenshots

import { spawn } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "docs/images");
const port = 4399;
const base = `http://127.0.0.1:${port}`;

// a throwaway library holding the demo shows, with The Tempest open
const work = mkdtempSync(join(tmpdir(), "cuemute-screenshots-"));
const library = join(work, "shows");
mkdirSync(library);
for (const f of ["tempest.json", "twelfth-night.json"]) copyFileSync(join(root, "docs/demo", f), join(library, f));
writeFileSync(join(library, ".last-show"), "tempest.json\n");
writeFileSync(join(work, "cuemute.json"), JSON.stringify({ shows: "shows", port }));

// only the temporary config: settings from this shell must not reach a real show
const env = { ...process.env, CUEMUTE_CONFIG: join(work, "cuemute.json") };
for (const k of ["HOST", "PORT", "CUEMUTE_SHOW", "CUEMUTE_SHOWS"]) delete env[k];
const server = spawn(process.execPath, ["--import", "tsx", join(root, "packages/server/src/main.ts")], {
  cwd: root,
  env,
  stdio: "inherit",
});

const api = async (method, path, body) => {
  const res = await fetch(`${base}/api${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
  return res.json();
};

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const state = await api("GET", "/state");
      if (state.connected) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("cuemute didn't start");
}

try {
  await waitForServer();
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 860 }, deviceScaleFactor: 2 });
  const shot = async (name, target = page) => {
    await page.waitForTimeout(300);
    await target.screenshot({ path: join(out, `${name}.png`) });
    console.log(`screenshots: ${name}.png`);
  };
  // an element cropped to the bottom of its content, without the empty space below
  const shotContent = async (name, selector) => {
    await page.waitForTimeout(300);
    const clip = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const box = el.getBoundingClientRect();
      const bottom = Math.max(...[...el.querySelectorAll("*")].map((c) => c.getBoundingClientRect().bottom));
      return { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, bottom - box.y + 16) };
    }, selector);
    await page.screenshot({ path: join(out, `${name}.png`), clip, fullPage: true });
    console.log(`screenshots: ${name}.png`);
  };

  // mid-show: scenes 1 to 5 have fired, so scene 6 is next
  for (let i = 1; i <= 5; i++) await api("POST", `/jump/tempest-${i}`);
  await api("POST", "/mode", { mode: "show" });
  await page.goto(base);
  await shot("show-mode");
  await shotContent("next-panel", ".centre");

  // Edit mode, with a scene open in the editor
  await api("POST", "/mode", { mode: "edit" });
  await page.reload();
  await page.locator(".scenes li:not(.group)", { hasText: "Ariel enters" }).click();
  await shot("edit-mode");
  await shotContent("scene-editor", ".edit-panel");

  for (const [tab, name] of [
    ["Channels", "channels-tab"],
    ["Desk", "desk-tab"],
    ["Shows", "shows-tab"],
  ]) {
    await page.getByRole("button", { name: tab, exact: true }).click();
    await page.waitForTimeout(500); // the show list loads after the tab opens
    // show the binary's default folder, not this script's temporary one
    await page.evaluate((dir) => {
      for (const p of document.querySelectorAll(".shows-panel .hint")) p.textContent = p.textContent.replace(dir, "~/Library/Application Support/cuemute/shows");
    }, library);
    await shotContent(name, ".edit-panel");
  }

  // the backstage screen
  await api("POST", "/mode", { mode: "show" });
  await page.goto(`${base}/?view`);
  await shot("view-only");

  // cue sheets
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(`${base}/?print&layout=list`);
  await shotContent("cue-list", ".cue-sheet");
  await page.goto(`${base}/?print&layout=plot&tracked`);
  await shotContent("mic-plot", ".cue-sheet");

  await browser.close();
} finally {
  server.kill();
  rmSync(work, { recursive: true, force: true });
}
