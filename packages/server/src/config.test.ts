import { mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  let root: string;
  const write = (name: string, body: unknown) =>
    writeFileSync(join(root, name), typeof body === "string" ? body : JSON.stringify(body));

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "cuemute-config-"));
  });

  it("uses defaults without a file", () => {
    expect(loadConfig(root, {})).toEqual({
      host: "127.0.0.1",
      port: 4000,
      showPath: join(root, "shows/show.json"),
    });
  });

  it("reads cuemute.json, with the show path relative to the file", () => {
    write("cuemute.json", { host: "192.168.1.10", port: 4100, show: "shows/woods.json" });
    expect(loadConfig(root, {})).toEqual({
      host: "192.168.1.10",
      port: 4100,
      showPath: join(root, "shows/woods.json"),
    });
  });

  it("lets environment variables override the file", () => {
    write("cuemute.json", { host: "192.168.1.10", port: 4100 });
    expect(loadConfig(root, { HOST: "10.0.0.2", PORT: "4200", CUEMUTE_SHOW: "~/x.json" })).toEqual({
      host: "10.0.0.2",
      port: 4200,
      showPath: join(homedir(), "x.json"),
    });
  });

  it("reads the file named by CUEMUTE_CONFIG", () => {
    write("venue.json", { host: "10.1.1.1" });
    expect(loadConfig("/nowhere", { CUEMUTE_CONFIG: join(root, "venue.json") }).host).toBe("10.1.1.1");
    expect(() => loadConfig(root, { CUEMUTE_CONFIG: join(root, "missing.json") })).toThrow(/doesn't exist/);
  });

  it("explains a bad file", () => {
    write("cuemute.json", "{ host: ");
    expect(() => loadConfig(root, {})).toThrow(/cuemute\.json/);
    write("cuemute.json", { hots: "192.168.1.10" });
    expect(() => loadConfig(root, {})).toThrow(/hots/);
    write("cuemute.json", { port: "4000" });
    expect(() => loadConfig(root, {})).toThrow(/port/);
  });
});
