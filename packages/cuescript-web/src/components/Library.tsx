import { useEffect, useRef, useState } from "react";
import type { ProductionSummary } from "@cuemute/script";
import { api } from "../api.ts";
import { useRun } from "../useRun.ts";

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const openUrl = (id: string) => `?p=${encodeURIComponent(id)}`;

// Every production in this copy of cuescript. Export and Import move a
// production between machines, for example from a hosted copy to the show laptop.
export function Library() {
  const { run, error } = useRun();
  const [list, setList] = useState<ProductionSummary[] | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const refresh = () => run(async () => setList((await api<{ productions: ProductionSummary[] }>("GET", "/productions")).productions));
  useEffect(refresh, []);

  const create = () => {
    const name = window.prompt("Name of the new production", "");
    if (name === null) return;
    run(async () => {
      const { id } = await api<{ id: string }>("POST", "/productions", { name });
      location.search = openUrl(id);
    });
  };

  const importFile = (file: File) =>
    run(async () => {
      let data: unknown;
      try {
        data = JSON.parse(await file.text());
      } catch {
        throw new Error(`${file.name} isn't a cuescript production file`);
      }
      const { id } = await api<{ id: string }>("POST", "/productions/import", data);
      location.search = openUrl(id);
    });

  const remove = (p: ProductionSummary) => {
    if (!confirm(`Delete "${p.name}" and its script? This can't be undone.`)) return;
    run(async () => {
      await api("DELETE", `/productions/${encodeURIComponent(p.id)}`);
      refresh();
    });
  };

  return (
    <div className="library">
      <header>
        <strong>cuescript</strong>
      </header>
      {error && <div className="toast">{error}</div>}
      <main>
        <h1>Productions</h1>
        <div className="toolbar">
          <button onClick={create}>New production</button>
          <button onClick={() => picker.current?.click()} title="Add a production exported from another copy of cuescript">
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
        {list?.length === 0 && <p className="empty">No productions yet.</p>}
        <ul className="production-list">
          {list?.map((p) => (
            <li key={p.id}>
              <a className="production-name" href={openUrl(p.id)}>
                {p.name}
              </a>
              <span className="hint">
                {p.script ?? "No script"} · {when(p.modified)}
              </span>
              <span className="actions">
                <a className="button" href={`/api/productions/${encodeURIComponent(p.id)}/export`} download>
                  Export
                </a>
                <button className="danger" onClick={() => remove(p)}>
                  Delete
                </button>
              </span>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
