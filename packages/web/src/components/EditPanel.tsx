import { useState } from "react";
import type { Scene, Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";
import { SceneEditor } from "./SceneEditor.tsx";
import { ChannelsEditor } from "./ChannelsEditor.tsx";
import { DeskSettings } from "./DeskSettings.tsx";
import { ShowsPanel } from "./ShowsPanel.tsx";

interface Props {
  snapshot: Snapshot;
  selected: Scene | null;
  onSelect: (id: string | null) => void;
  run: Run;
}

type Tab = "scene" | "channels" | "desk" | "shows";

const TABS: { id: Tab; label: string }[] = [
  { id: "scene", label: "Scene" },
  { id: "channels", label: "Channels" },
  { id: "desk", label: "Desk" },
  { id: "shows", label: "Shows" },
];

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
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "on" : ""} onClick={() => setTab(t.id)}>
            {t.label}
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
                  disabled={snapshot.cursor.next === selected.id}
                  onClick={() => run(() => api("POST", `/next/${selected.id}`))}
                  title="Make this the scene GO fires next. Sends nothing."
                >
                  Set as next
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
            <SceneEditor
              key={selected.id}
              scene={selected}
              channels={snapshot.show.channels}
              groups={[...new Set(snapshot.show.scenes.map((s) => s.group).filter(Boolean))]}
              run={run}
            />
          ) : (
            <p className="empty">Select a scene to edit it.</p>
          )}
        </>
      )}

      {tab === "channels" && <ChannelsEditor key={snapshot.file} snapshot={snapshot} run={run} />}
      {tab === "desk" && <DeskSettings key={snapshot.file} snapshot={snapshot} run={run} />}
      {tab === "shows" && <ShowsPanel snapshot={snapshot} run={run} />}
    </aside>
  );
}
