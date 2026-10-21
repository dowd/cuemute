import { useEffect, useRef, useState } from "react";
import type { Cue, LinkState } from "@cuemute/script";
import { api, upload } from "../api.ts";
import { useProduction } from "../useProduction.ts";
import { useRun } from "../useRun.ts";
import { useScript } from "../useScript.ts";
import { CuesPanel } from "./CuesPanel.tsx";
import { ScriptReader, type WordAt } from "./ScriptReader.tsx";

// Whether this screen has the Cues panel open is a per-screen choice, so a
// screen that only follows the show never places a cue by a stray tap.
const PANEL_KEY = "cuescript.cuesPanel";
function loadPanel(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) === "true";
  } catch {
    return false;
  }
}

function linkPill(link: LinkState) {
  if (link.status === "off") return null;
  if (link.status === "connected") {
    return <span className="pill ok">cuemute {link.mode === "edit" ? "· Edit mode" : ""}</span>;
  }
  return (
    <span className="pill bad" title={link.message}>
      {link.status === "connecting" ? "Connecting to cuemute…" : link.status === "other-show" ? "cuemute: other show" : "cuemute unreachable"}
    </span>
  );
}

// One production: its script and mute cues, which any number of screens can
// read and follow at once.
export function ProductionPage({ id }: { id: string }) {
  const state = useProduction(id);
  const { run, error } = useRun();
  const [notice, setNotice] = useState<string | null>(null);
  const [panel, setPanel] = useState(loadPanel);
  const [selected, setSelected] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const production = state.status === "ready" ? state.production : null;
  const script = useScript(id, production?.script ?? null);
  const path = `/productions/${encodeURIComponent(id)}`;

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(t);
  }, [notice]);

  if (state.status === "loading") return <div className="loading">Connecting to cuescript…</div>;
  if (state.status === "gone") {
    return (
      <div className="loading">
        {state.message}. <a href="?">Back to productions</a>
      </div>
    );
  }
  const { production: p, link, online } = state;

  const togglePanel = () => {
    setPanel(!panel);
    try {
      localStorage.setItem(PANEL_KEY, String(!panel));
    } catch {
      // private window or blocked storage: the choice lasts until reload
    }
  };

  const rename = () => {
    const name = window.prompt("Production name", p.name);
    if (name === null || !name.trim() || name.trim() === p.name) return;
    run(() => api("PUT", `${path}/name`, { name: name.trim() }));
  };

  const importScript = (file: File) => {
    if (p.script && !confirm(`Replace the script ${p.script.name} with ${file.name}?`)) return;
    run(async () => {
      setNotice(null);
      const r = await upload<{ paragraphs: number; cues: number }>(
        "PUT",
        `${path}/script?name=${encodeURIComponent(file.name)}`,
        file,
      );
      const cues = p.cues.length > 0 || r.cues > 0 ? ` ${r.cues} cue${r.cues === 1 ? "" : "s"} placed.` : "";
      setNotice(`Read ${r.paragraphs} lines from ${file.name}.${cues}`);
    });
  };

  const place = (at: WordAt) =>
    selected && run(() => api("PUT", `${path}/cues/scene/${encodeURIComponent(selected)}`, at));

  const newScene = (at: WordAt) =>
    run(async () => {
      const { cue } = await api<{ cue: Cue }>("POST", `${path}/cues/new-scene`, at);
      setSelected(cue.scene);
      setNotice("Added a scene to cuemute. Set its mutes in cuemute.");
    });

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
          {linkPill(link)}
          {p.script && <span className="hint">{p.script.name}</span>}
        </div>
        <div className="controls">
          {p.script && (
            <button className={panel ? "on" : ""} onClick={togglePanel} title="Link to cuemute and place mute cues, on this screen">
              Cues
            </button>
          )}
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
        <div className={`reader ${panel ? "with-panel" : ""}`}>
          <ScriptReader
            script={script}
            cues={p.cues}
            link={link}
            editing={panel}
            selected={selected}
            onSelect={setSelected}
            onPlace={place}
            onNewScene={newScene}
          />
          {panel && (
            <CuesPanel production={p} link={link} selected={selected} onSelect={setSelected} onNotice={setNotice} run={run} />
          )}
        </div>
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
