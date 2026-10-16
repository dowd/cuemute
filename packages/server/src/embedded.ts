import { getAssetKeys, getRawAsset } from "node:sea";

// The web UI the packaged binary carries. scripts/build-binary.mjs embeds each
// file of packages/web/dist as an asset named "web/<path>".
export function embeddedWebFiles(): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  for (const key of getAssetKeys()) {
    if (key.startsWith("web/")) files.set(key.slice(4), Buffer.from(getRawAsset(key)));
  }
  return files;
}
