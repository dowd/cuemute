import { useState } from "react";
import type { ConsoleSettings, Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

const TYPES: { value: ConsoleSettings["type"]; label: string }[] = [
  { value: "sim", label: "Simulated desk" },
  { value: "qu", label: "Allen & Heath Qu" },
  { value: "sq", label: "Allen & Heath SQ" },
];

export function DeskSettings({ snapshot, run }: { snapshot: Snapshot; run: Run }) {
  const [draft, setDraft] = useState<ConsoleSettings>(snapshot.show.console);
  const needsHost = draft.type !== "sim";

  return (
    <div className="desk-settings">
      <label>
        Desk
        <select
          value={draft.type}
          onChange={(e) => setDraft({ ...draft, type: e.target.value as ConsoleSettings["type"] })}
        >
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      {needsHost && (
        <label>
          IP address
          <input
            value={draft.host}
            placeholder="192.168.1.70"
            onChange={(e) => setDraft({ ...draft, host: e.target.value.trim() })}
          />
        </label>
      )}
      {draft.type === "sq" && (
        <label>
          MIDI channel (Utility / General / MIDI on the desk)
          <input
            type="number"
            min={1}
            max={16}
            value={draft.midiChannel}
            onChange={(e) => setDraft({ ...draft, midiChannel: Number(e.target.value) })}
          />
        </label>
      )}
      <div className="toolbar">
        <button onClick={() => run(() => api("PUT", "/console", draft))}>Connect</button>
      </div>

      {snapshot.connection.type === "sim" && snapshot.connection.state === "connected" && (
        <SimDesk snapshot={snapshot} run={run} />
      )}
    </div>
  );
}

// Changes made "by hand on the desk", for trying Record without hardware.
function SimDesk({ snapshot, run }: { snapshot: Snapshot; run: Run }) {
  const inputs = Object.keys(snapshot.live)
    .filter((k) => k.startsWith("input:"))
    .map((k) => Number(k.slice("input:".length)))
    .sort((a, b) => a - b);

  return (
    <div className="sim-desk">
      <h4>Simulated desk</h4>
      <p className="hint">Mutes changed here act like changes made by hand on a real desk.</p>
      <div className="sim-grid">
        {inputs.map((n) => {
          const muted = snapshot.live[`input:${n}`];
          return (
            <button
              key={n}
              className={muted ? "muted" : "open"}
              onClick={() => run(() => api("POST", `/sim/channels/${n}/mute`, { muted: !muted }))}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
