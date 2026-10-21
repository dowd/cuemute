import { useEffect, useState } from "react";
import type { Snapshot } from "@cuemute/core";

const RETRY_MS = 1000;

// Waits until the server answers over plain HTTP. Firefox delays a WebSocket
// to an address after each refused connection, longer each time and for every
// tab, so retrying the socket itself while the server is down can leave a new
// tab waiting many seconds once it is back. A refused fetch costs nothing.
async function serverUp(): Promise<void> {
  for (;;) {
    try {
      await fetch("/", { method: "HEAD", cache: "no-store" });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, RETRY_MS));
    }
  }
}

// The latest snapshot from the server, and whether the socket is up. Reconnects
// on its own; while it is down the snapshot is the last one received.
export function useSnapshot(): { snapshot: Snapshot | null; online: boolean } {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws`);
      socket.onopen = () => setOnline(true);
      socket.onmessage = (e) => setSnapshot(JSON.parse(e.data as string) as Snapshot);
      socket.onclose = () => {
        setOnline(false);
        if (!closed) retry = setTimeout(() => serverUp().then(() => !closed && open()), RETRY_MS);
      };
    };
    open();

    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return { snapshot, online };
}
