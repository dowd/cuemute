import { useRef, useState } from "react";
import { api, upload } from "../api.ts";
import { useProduction } from "../useProduction.ts";
import { useRun } from "../useRun.ts";
import { useScript } from "../useScript.ts";
import { ScriptReader } from "./ScriptReader.tsx";

// One production: its script, which any number of screens can read at once.
export function ProductionPage({ id }: { id: string }) {
  const state = useProduction(id);
  const { run, error } = useRun();
  const [notice, setNotice] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const production = state.status === "ready" ? state.production : null;
  const script = useScript(id, production?.script ?? null);
  const path = `/productions/${encodeURIComponent(id)}`;

  if (state.status === "loading") return <div className="loading">Connecting to cuescript…</div>;
  if (state.status === "gone") {
    return (
      <div className="loading">
        {state.message}. <a href="?">Back to productions</a>
      </div>
    );
  }
  const { production: p, online } = state;

  const rename = () => {
    const name = window.prompt("Production name", p.name);
    if (name === null || !name.trim() || name.trim() === p.name) return;
    run(() => api("PUT", `${path}/name`, { name: name.trim() }));
  };

  const importScript = (file: File) => {
    if (p.script && !confirm(`Replace the script ${p.script.name} with ${file.name}?`)) return;
    run(async () => {
      setNotice(null);
      const r = await upload<{ paragraphs: number }>("PUT", `${path}/script?name=${encodeURIComponent(file.name)}`, file);
      setNotice(`Read ${r.paragraphs} lines from ${file.name}.`);
    });
  };

  return (
    <div className="production">
      <header>
        <div className="title">
          <a href="?" className="back-link" title="All productions">
            ‹ Productions
          </a>
          <button className="production-title" title="Rename the production" onClick={rename}>
            {p.name} <span className="pencil">✎</span>
          </button>
          {!online && <span className="pill bad">Server unreachable</span>}
          {p.script && <span className="hint">{p.script.name}</span>}
        </div>
        <div className="controls">
          <button onClick={() => picker.current?.click()}>{p.script ? "Import new version…" : "Import script…"}</button>
          <a className="button" href={`/api${path}/export`} download title="Save this production as a file">
            Export
          </a>
          <input
            ref={picker}
            type="file"
            accept=".docx,.txt,.md,text/plain"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = ""; // so the same file can be picked again
              if (file) importScript(file);
            }}
          />
        </div>
      </header>
      {error && <div className="toast">{error}</div>}
      {notice && (
        <div className="notice" onClick={() => setNotice(null)}>
          {notice}
        </div>
      )}
      {script ? (
        <ScriptReader script={script} />
      ) : p.script ? (
        <div className="loading">Loading the script…</div>
      ) : (
        <div className="empty-script">
          <h2>No script yet</h2>
          <p>
            Import the script as a Word file (.docx), plain text or Markdown. From Google Docs, use{" "}
            <strong>File &gt; Download &gt; Microsoft Word</strong>.
          </p>
          <button onClick={() => picker.current?.click()}>Import script…</button>
        </div>
      )}
    </div>
  );
}
