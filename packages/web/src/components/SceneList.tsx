import type { Snapshot } from "@cuemute/core";
import { api } from "../api.ts";
import type { Run } from "../App.tsx";

interface Props {
  snapshot: Snapshot;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  viewOnly: boolean;
  run: Run;
}

// Click selects a scene (to preview or edit it). Double-click fires it, so a
// stray click mid-show never changes the desk.
export function SceneList({ snapshot, selectedId, onSelect, viewOnly, run }: Props) {
  const { scenes } = snapshot.show;
  const dupes = new Set(snapshot.duplicateNumbers);

  return (
    <nav className="scenes">
      {scenes.length === 0 && <p className="empty">No scenes yet. Add one in Edit mode.</p>}
      <ol>
        {scenes.map((s) => {
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
              <span className={`num ${dupes.has(s.number.trim()) ? "dupe" : ""}`}>
                {s.number || "–"}
              </span>
              <span className="name">{s.name || <em>Untitled</em>}</span>
              {s.lineRef && <span className="line">{s.lineRef}</span>}
              {s.id === snapshot.cursor.next && <span className="tag">NEXT</span>}
              {s.id === snapshot.cursor.current && <span className="tag live">LIVE</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
