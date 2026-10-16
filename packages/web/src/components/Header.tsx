import type { Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

interface Props {
  snapshot: Snapshot;
  online: boolean;
  viewOnly: boolean;
  editing: boolean;
  run: Run;
}

export function Header({ snapshot, online, viewOnly, editing, run }: Props) {
  const { connection, mode, cursor } = snapshot;
  const deskUp = connection.state === "connected";

  let status = "Desk disconnected";
  if (!online) status = "Server unreachable";
  else if (connection.state === "connecting") status = "Connecting to desk…";
  else if (deskUp) status = connection.synced ? "Desk connected" : "Reading desk…";

  const rename = () => {
    const name = window.prompt("Show name", snapshot.show.name);
    if (name === null || !name.trim() || name.trim() === snapshot.show.name) return;
    run(() => api("PUT", "/show/name", { name: name.trim() }));
  };

  return (
    <header>
      <div className="title">
        {editing ? (
          <button className="show-name" title="Rename the show" onClick={rename}>
            {snapshot.show.name} <span className="pencil">✎</span>
          </button>
        ) : (
          <strong>{snapshot.show.name}</strong>
        )}
        <span className={`pill ${online && deskUp ? "ok" : "bad"}`} title={connection.info}>
          {status}
        </span>
        {connection.info && <span className="info">{connection.info}</span>}
        <a className="sheet-link" href="?print" target="_blank" rel="noopener" title="Cue list and mic plot to print or save as PDF">
          Cue sheet
        </a>
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
          <button className="back" onClick={() => run(() => api("POST", "/back"))} title="← key">
            Back
          </button>
          <button
            className="back"
            disabled={cursor.next === null}
            onClick={() => run(() => api("POST", "/forward"))}
            title="→ key: skip a scene without firing it"
          >
            Forward
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
