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

  // Space is GO anywhere except while typing
  useEffect(() => {
    if (viewOnly) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault(); // also stops a focused button activating
      run(() => api("POST", "/go"));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  if (!snapshot) return <div className="loading">Connecting to cuemute…</div>;

  const editing = snapshot.mode === "edit" && !viewOnly;
  const scenes = snapshot.show.scenes;
  const selected = scenes.find((s) => s.id === selectedId) ?? null;
  // the grid previews the selected scene, or else the one GO will fire
  const preview = selected ?? scenes.find((s) => s.id === snapshot.cursor.next) ?? null;

  return (
    <div className={`app ${editing ? "editing" : "showing"}`}>
      <Header snapshot={snapshot} online={online} viewOnly={viewOnly} run={run} />
      {error && <div className="toast">{error}</div>}
      <main>
        <SceneList
          snapshot={snapshot}
          selectedId={selectedId}
          onSelect={setSelectedId}
          viewOnly={viewOnly}
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
