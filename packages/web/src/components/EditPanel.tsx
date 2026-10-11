import { useState } from "react";
import type { Scene, Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";
import { SceneEditor } from "./SceneEditor.tsx";
import { ChannelsEditor } from "./ChannelsEditor.tsx";
import { DeskSettings } from "./DeskSettings.tsx";

interface Props {
  snapshot: Snapshot;
  selected: Scene | null;
  onSelect: (id: string | null) => void;
  run: Run;
}

type Tab = "scene" | "channels" | "desk";

export function EditPanel({ snapshot, selected, onSelect, run }: Props) {
  const [tab, setTab] = useState<Tab>("scene");
  const scenes = snapshot.show.scenes;
  const index = selected ? scenes.findIndex((s) => s.id === selected.id) : -1;
  // new scenes go after the selected one, or after the live one
  const anchor = selected?.id ?? snapshot.cursor.current ?? scenes.at(-1)?.id ?? null;

  const addScene = () =>
    run(async () => {
      const { scene } = await api<{ scene: Scene }>("POST", "/scenes", { afterId: anchor });
      onSelect(scene.id);
    });

  const record = () =>
    run(async () => {
      const { scene } = await api<{ scene: Scene }>("POST", "/record");
      onSelect(scene.id);
    });

  return (
    <aside className="edit-panel">
      <div className="tabs">
        {(["scene", "channels", "desk"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "scene" ? "Scene" : t === "channels" ? "Channels" : "Desk"}
          </button>
        ))}
      </div>

      {tab === "scene" && (
        <>
          <div className="toolbar">
            <button onClick={addScene}>Add scene</button>
            <button onClick={record} title="New scene from the desk's changes since the last GO">
              Record
            </button>
            {selected && (
              <>
                <button
                  disabled={index <= 0}
                  onClick={() =>
                    run(() => api("POST", `/scenes/${selected.id}/move`, { toIndex: index - 1 }))
                  }
                >
                  ↑
                </button>
                <button
                  disabled={index >= scenes.length - 1}
                  onClick={() =>
                    run(() => api("POST", `/scenes/${selected.id}/move`, { toIndex: index + 1 }))
                  }
                >
                  ↓
                </button>
                <button
                  className="danger"
                  onClick={() => {
                    if (!confirm(`Delete scene ${selected.number} ${selected.name}?`)) return;
                    run(async () => {
                      await api("DELETE", `/scenes/${selected.id}`);
                      onSelect(null);
                    });
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </div>
          {selected ? (
            <SceneEditor key={selected.id} scene={selected} channels={snapshot.show.channels} run={run} />
          ) : (
            <p className="empty">Select a scene to edit it.</p>
          )}
        </>
      )}

      {tab === "channels" && <ChannelsEditor snapshot={snapshot} run={run} />}
      {tab === "desk" && <DeskSettings snapshot={snapshot} run={run} />}
    </aside>
  );
}
