import { useState } from "react";
import { groupRuns, type Scene, type Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

interface Props {
  snapshot: Snapshot;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  viewOnly: boolean;
  editing: boolean;
  run: Run;
}

// Collapsed groups are a per-screen preference, so they live in this browser only.
const STORAGE_KEY = "cuemute.collapsedGroups";

function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function saveCollapsed(groups: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]));
  } catch {
    // private window or blocked storage: collapsing still works until reload
  }
}

// Click selects a scene (to preview or edit it). Double-click fires it, so a
// stray click mid-show never changes the desk. Neighbouring scenes in the same
// group sit under a heading that collapses; the group holding the live, next or
// selected scene always stays open.
export function SceneList({ snapshot, selectedId, onSelect, viewOnly, editing, run }: Props) {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const { scenes } = snapshot.show;
  const dupes = new Set(snapshot.duplicateNumbers);
  const active = new Set([snapshot.cursor.current, snapshot.cursor.next, selectedId]);

  const toggle = (group: string) => {
    const next = new Set(collapsed);
    if (!next.delete(group)) next.add(group);
    setCollapsed(next);
    saveCollapsed(next);
  };

  const rename = (group: string) => {
    const to = window.prompt(`Rename the group "${group}" on every scene that has it`, group);
    if (to === null || to.trim() === group) return;
    run(() => api("POST", "/groups/rename", { from: group, to }));
  };

  const row = (s: Scene) => {
    const classes = [
      s.id === snapshot.cursor.current && "current",
      s.id === snapshot.cursor.next && "next",
      s.id === selectedId && "selected",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <li
        key={s.id}
        className={classes}
        style={{ borderLeftColor: s.colour || "transparent" }}
        onClick={() => onSelect(s.id === selectedId ? null : s.id)}
        onDoubleClick={() => !viewOnly && run(() => api("POST", `/jump/${s.id}`))}
      >
        <span className={`num ${dupes.has(s.number.trim()) ? "dupe" : ""}`}>{s.number || "–"}</span>
        <span className="name">{s.name || <em>Untitled</em>}</span>
        {s.lineRef && <span className="line">{s.lineRef}</span>}
        {s.id === snapshot.cursor.next && <span className="tag">NEXT</span>}
        {s.id === snapshot.cursor.current && <span className="tag live">LIVE</span>}
      </li>
    );
  };

  return (
    <nav className="scenes">
      {scenes.length === 0 && <p className="empty">No scenes yet. Add one in Edit mode.</p>}
      <ol>
        {groupRuns(scenes).map((r) => {
          if (!r.group) return r.scenes.map(row);
          const pinned = r.scenes.some((s) => active.has(s.id));
          const open = pinned || !collapsed.has(r.group);
          return (
            <li key={`group-${r.start}`} className="group">
              <div
                className={`group-head ${pinned ? "pinned" : ""}`}
                onClick={() => !pinned && toggle(r.group)}
                title={pinned ? "Holds the live, next or selected scene, so it stays open" : undefined}
              >
                <span className="chevron">{open ? "▾" : "▸"}</span>
                <span className="group-name">{r.group}</span>
                <span className="count">{r.scenes.length}</span>
                {editing && (
                  <button
                    className="rename"
                    onClick={(e) => {
                      e.stopPropagation();
                      rename(r.group);
                    }}
                  >
                    Rename
                  </button>
                )}
              </div>
              {open && <ol>{r.scenes.map(row)}</ol>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
