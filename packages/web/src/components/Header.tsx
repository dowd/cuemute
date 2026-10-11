import type { Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

interface Props {
  snapshot: Snapshot;
  online: boolean;
  viewOnly: boolean;
  run: Run;
}

export function Header({ snapshot, online, viewOnly, run }: Props) {
  const { connection, mode, cursor } = snapshot;
  const deskUp = connection.state === "connected";

  let status = "Desk disconnected";
  if (!online) status = "Server unreachable";
  else if (connection.state === "connecting") status = "Connecting to desk…";
  else if (deskUp) status = connection.synced ? "Desk connected" : "Reading desk…";

  return (
    <header>
      <div className="title">
        <strong>{snapshot.show.name}</strong>
        <span className={`pill ${online && deskUp ? "ok" : "bad"}`} title={connection.info}>
          {status}
        </span>
        {connection.info && <span className="info">{connection.info}</span>}
      </div>

      {!viewOnly && (
        <div className="controls">
          <div className="mode">
            {(["show", "edit"] as const).map((m) => (
              <button
                key={m}
                className={mode === m ? "on" : ""}
                onClick={() => run(() => api("POST", "/mode", { mode: m }))}
              >
                {m === "show" ? "Show" : "Edit"}
              </button>
            ))}
          </div>
          <button className="back" onClick={() => run(() => api("POST", "/back"))}>
            Back
          </button>
          <button
            className="go"
            disabled={!deskUp || cursor.next === null}
            onClick={() => run(() => api("POST", "/go"))}
            title="Space"
          >
            GO
          </button>
        </div>
      )}

      {online && !deskUp && <div className="banner">Desk not connected: GO is disabled</div>}
    </header>
  );
}
