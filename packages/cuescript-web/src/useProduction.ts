import { useEffect, useState } from "react";
import type { ProductionView } from "@cuemute/script";

const RETRY_MS = 1000;

export type ProductionState =
  | { status: "loading" }
  | { status: "ready"; production: ProductionView; online: boolean }
  | { status: "gone"; message: string };

// A production's latest state, pushed by the server on every change. Reconnects
// on its own; while the socket is down the state is the last one received.
export function useProduction(id: string): ProductionState {
  const [state, setState] = useState<ProductionState>({ status: "loading" });

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws/productions/${encodeURIComponent(id)}`);
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as { production?: ProductionView; deleted?: true; error?: string };
        if (msg.production) setState({ status: "ready", production: msg.production, online: true });
        else {
          closed = true; // a deleted or missing production won't come back
          setState({ status: "gone", message: msg.error ?? "This production was deleted" });
        }
      };
      socket.onclose = () => {
        setState((s) => (s.status === "ready" ? { ...s, online: false } : s));
        if (!closed) retry = setTimeout(open, RETRY_MS);
      };
    };
    open();

    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, [id]);

  return state;
}
