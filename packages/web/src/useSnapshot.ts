import { useEffect, useState } from "react";
import type { Snapshot } from "@cuemute/core";

const RETRY_MS = 1000;

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
        if (!closed) retry = setTimeout(open, RETRY_MS);
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
