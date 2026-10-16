import { useEffect, useRef, useState } from "react";
import type { Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

interface ShowEntry {
  file: string;
  name: string;
  scenes: number;
  modified: string;
  error?: string;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// The show library: every show in cuemute's shows folder. Opening a show sends
// nothing to the desk. Export and Import move a show file between machines.
export function ShowsPanel({ snapshot, run }: { snapshot: Snapshot; run: Run }) {
  const [library, setLibrary] = useState<{ dir: string; shows: ShowEntry[] } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const open = snapshot.file;

  const refresh = () => run(async () => setLibrary(await api("GET", "/shows")));
  // reload when the open show changes or is renamed
  useEffect(refresh, [open, snapshot.show.name]);

  const act = (action: () => Promise<unknown>) =>
    run(async () => {
      try {
        await action();
      } finally {
        setLibrary(await api("GET", "/shows"));
      }
    });

  const create = () => {
    const name = window.prompt("Name of the new show", "");
    if (name === null) return;
    act(() => api("POST", "/shows", { name }));
  };

  const duplicate = (s: ShowEntry) => {
    const name = window.prompt(`Name of the copy of "${s.name}"`, `${s.name} copy`);
    if (name === null) return;
    act(() => api("POST", `/shows/${encodeURIComponent(s.file)}/duplicate`, { name }));
  };

  const remove = (s: ShowEntry) => {
    if (!confirm(`Delete "${s.name}" (${s.file}) and its backup? This can't be undone.`)) return;
    act(() => api("DELETE", `/shows/${encodeURIComponent(s.file)}`));
  };

  const importFile = (file: File) =>
    act(async () => {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error(`${file.name} isn't a cuemute show file`);
      }
      await api("POST", "/shows/import", data);
    });

  return (
    <div className="shows-panel">
      <div className="toolbar">
        <button onClick={create} title="An empty show for the same desk">
          New show
        </button>
        <button onClick={() => picker.current?.click()} title="Add a show file from this computer and open it">
          Import…
        </button>
        <input
          ref={picker}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // so the same file can be picked again
            if (file) importFile(file);
          }}
        />
      </div>
      <p className="hint">Opening a show sends nothing to the desk. Its first scene is next.</p>

      {library && (
        <>
          <ul className="show-list">
            {library.shows.map((s) => {
              const isOpen = s.file === open;
              return (
                <li key={s.file} className={isOpen ? "open" : ""}>
                  <div className="show-info">
                    <span className="show-title">
                      {s.name}
                      {isOpen && <span className="tag">OPEN</span>}
                    </span>
                    <span className="hint">
                      {s.error ?? `${s.scenes} scene${s.scenes === 1 ? "" : "s"} · ${when(s.modified)}`} · {s.file}
                    </span>
                  </div>
                  <div className="show-actions">
                    {!isOpen && !s.error && (
                      <button onClick={() => act(() => api("POST", `/shows/${encodeURIComponent(s.file)}/open`))}>
                        Open
                      </button>
                    )}
                    {!s.error && (
                      <>
                        <button onClick={() => duplicate(s)} title="Save a copy under a new name, and open it">
                          Duplicate
                        </button>
                        <a className="button" href={`/api/shows/${encodeURIComponent(s.file)}/export`} download={s.file}>
                          Export
                        </a>
                      </>
                    )}
                    {!isOpen && (
                      <button className="danger" onClick={() => remove(s)}>
                        Delete
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="hint">Shows are kept in {library.dir}</p>
        </>
      )}
    </div>
  );
}
