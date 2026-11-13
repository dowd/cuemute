import { useEffect, useState } from "react";
import { linkOff, type LinkState, type ProductionView } from "@cuemute/script";
import { readSaved, saveForOffline } from "./offline.ts";

const RETRY_MS = 1000;
// how long to wait for the server before showing the saved copy
const SAVED_AFTER_MS = 2000;

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

export type ProductionState =
  | { status: "loading" }
  | { status: "ready"; production: ProductionView; link: LinkState; online: boolean }
  | { status: "gone"; message: string };

// A production's latest state and its cuemute link, pushed by the server on every change. Reconnects
// on its own; while the socket is down the state is the last one received.
export function useProduction(id: string): ProductionState {
  const [state, setState] = useState<ProductionState>({ status: "loading" });

  useEffect(() => {
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let savedTried = false;

    const open = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${proto}://${location.host}/ws/productions/${encodeURIComponent(id)}`);
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data as string) as {
          production?: ProductionView;
          link?: LinkState;
          deleted?: true;
          error?: string;
        };
        if (msg.production) {
          const production = msg.production;
          // the same view GET /api/productions/:id answers with
          saveForOffline(`/productions/${encodeURIComponent(id)}`, production);
          setState((s) => ({ status: "ready", production, link: s.status === "ready" ? s.link : linkOff, online: true }));
        } else if (msg.link) {
          const link = msg.link;
          setState((s) => (s.status === "ready" ? { ...s, link } : s));
        } else {
          closed = true; // a deleted or missing production won't come back
          setState({ status: "gone", message: msg.error ?? "This production was deleted" });
        }
      };
      socket.onclose = () => {
        setState((s) => (s.status === "ready" ? { ...s, online: false } : s));
        useSaved();
        if (!closed) retry = setTimeout(() => serverUp().then(() => !closed && open()), RETRY_MS);
      };
    };
    // If nothing has come yet, the server can't be reached; show the copy this
    // device saved earlier, if there is one. A server that doesn't answer at all
    // can leave the socket neither open nor closed, so this also runs on a timer.
    const useSaved = () => {
      if (closed || savedTried) return;
      savedTried = true;
      readSaved<ProductionView>(`/productions/${encodeURIComponent(id)}`)
        .then((production) => {
          if (production) setState((s) => (s.status === "loading" ? { status: "ready", production, link: linkOff, online: false } : s));
        })
        .catch(() => {});
    };
    const savedTimer = setTimeout(useSaved, SAVED_AFTER_MS);

    open();

    return () => {
      closed = true;
      clearTimeout(savedTimer);
      clearTimeout(retry);
      socket?.close();
    };
  }, [id]);

  return state;
}
