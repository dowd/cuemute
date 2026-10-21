import { useEffect, useRef } from "react";
import type { Department } from "@cuemute/script";
import type { Filter } from "../cues.ts";

interface Props {
  departments: Department[];
  filter: Filter;
  onChange: (f: Filter) => void;
}

// Which departments' cues, and whether notes, this screen shows.
export function ShowMenu({ departments, filter, onChange }: Props) {
  const menu = useRef<HTMLDetailsElement>(null);
  // a click anywhere else closes the menu
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(e.target as Node)) menu.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const off = departments.filter((d) => filter.hidden.includes(d.id)).length + (filter.notes ? 0 : 1);
  const toggle = (id: string, on: boolean) =>
    onChange({ ...filter, hidden: on ? filter.hidden.filter((x) => x !== id) : [...filter.hidden, id] });

  return (
    <details className="show-menu" ref={menu}>
      <summary className={off > 0 ? "on" : ""} title="Which cues this screen shows">
        Show{off > 0 ? ` (${off} off)` : ""}
      </summary>
      <div className="menu">
        <p className="hint">On this screen only.</p>
        {departments.map((d) => (
          <label key={d.id} className="check">
            <input type="checkbox" checked={!filter.hidden.includes(d.id)} onChange={(e) => toggle(d.id, e.target.checked)} />
            <span className="swatch" style={{ background: d.colour }} />
            {d.code ? `${d.code} · ${d.name}` : d.name}
          </label>
        ))}
        <label className="check">
          <input type="checkbox" checked={filter.notes} onChange={(e) => onChange({ ...filter, notes: e.target.checked })} />
          Notes
        </label>
        {off > 0 && (
          <button onClick={() => onChange({ hidden: [], notes: true })}>Show everything</button>
        )}
      </div>
    </details>
  );
}
