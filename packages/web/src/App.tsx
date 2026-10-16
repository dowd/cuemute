import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api.ts";
import { useSnapshot } from "./useSnapshot.ts";
import { Header } from "./components/Header.tsx";
import { SceneList } from "./components/SceneList.tsx";
import { ChannelGrid } from "./components/ChannelGrid.tsx";
import { NextPanel } from "./components/NextPanel.tsx";
import { EditPanel } from "./components/EditPanel.tsx";

// ?view opens a read-only screen for backstage: no GO, no editing
const viewOnly = new URLSearchParams(location.search).has("view");

export type Run = (action: () => Promise<unknown>) => void;

export function App() {
  const { snapshot, online } = useSnapshot();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const run: Run = useCallback((action) => {
    action().catch((e: unknown) => {
      setError(e instanceof Error ? e.message : String(e));
      clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setError(null), 4000);
    });
  }, []);

  // Space is GO, and the arrow keys are Back and Forward, anywhere except while typing
  useEffect(() => {
    if (viewOnly) return;
    const keys: Record<string, string> = { Space: "/go", ArrowLeft: "/back", ArrowRight: "/forward" };
    const onKey = (e: KeyboardEvent) => {
      const path = keys[e.code];
      if (!path || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault(); // also stops a focused button activating
      run(() => api("POST", path));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  if (!snapshot) return <div className="loading">Connecting to cuemute…</div>;

  const editing = snapshot.mode === "edit" && !viewOnly;
  const scenes = snapshot.show.scenes;
  const selected = scenes.find((s) => s.id === selectedId) ?? null;
  // the grid always previews the scene GO will fire; selecting a scene is for editing
  const preview = scenes.find((s) => s.id === snapshot.cursor.next) ?? null;

  return (
    <div className={`app ${editing ? "editing" : "showing"}`}>
      <Header snapshot={snapshot} online={online} viewOnly={viewOnly} editing={editing} run={run} />
      {error && <div className="toast">{error}</div>}
      <main>
        <SceneList
          snapshot={snapshot}
          selectedId={selectedId}
          onSelect={setSelectedId}
          viewOnly={viewOnly}
          editing={editing}
          run={run}
        />
        <section className="centre">
          <NextPanel snapshot={snapshot} />
          <ChannelGrid snapshot={snapshot} preview={preview} viewOnly={viewOnly} run={run} />
        </section>
        {editing && (
          <EditPanel snapshot={snapshot} selected={selected} onSelect={setSelectedId} run={run} />
        )}
      </main>
    </div>
  );
}
