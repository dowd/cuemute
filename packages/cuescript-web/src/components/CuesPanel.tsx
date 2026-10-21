import { useState } from "react";
import type { Cue, LinkState, ProductionView } from "@cuemute/script";
import { api } from "../api.ts";
import type { Run } from "../useRun.ts";

interface Props {
  production: ProductionView;
  link: LinkState;
  selected: string | null;
  onSelect: (scene: string | null) => void;
  onNotice: (message: string) => void;
  run: Run;
}

// The link to cuemute and its scenes, for placing mute cues. Select a scene
// here, then a word in the script.
export function CuesPanel({ production, link, selected, onSelect, onNotice, run }: Props) {
  const [address, setAddress] = useState(production.link?.url ?? "http://127.0.0.1:4000");
  const path = `/productions/${encodeURIComponent(production.id)}`;
  const cueOf = new Map(production.cues.map((c) => [c.scene, c]));
  const connected = link.status === "connected";

  const linkTo = () =>
    run(async () => {
      const r = await api<{ show: string; placed: number }>("PUT", `${path}/link`, { url: address });
      onNotice(`Linked to "${r.show}" in cuemute. Placed ${r.placed} scene${r.placed === 1 ? "" : "s"} by their Line / cue.`);
    });

  const unlink = () => {
    if (!confirm("Unlink from cuemute? Mute cues stay in the script, but stop following the show.")) return;
    run(() => api("DELETE", `${path}/link`));
  };

  const autoPlace = () =>
    run(async () => {
      const r = await api<{ placed: number }>("POST", `${path}/cues/auto`);
      onNotice(`Placed ${r.placed} more scene${r.placed === 1 ? "" : "s"} by their Line / cue.`);
    });

  const unplace = (cue: Cue) => run(() => api("DELETE", `${path}/cues/${encodeURIComponent(cue.id)}`));

  if (!production.link) {
    return (
      <aside className="cues-panel">
        <h3>Link to cuemute</h3>
        <p className="hint">
          Type cuemute&apos;s address, with the show for this production open in it. cuescript then follows its live and
          next scenes, and places each scene by its Line / cue.
        </p>
        <form
          className="link-form"
          onSubmit={(e) => {
            e.preventDefault();
            linkTo();
          }}
        >
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="http://192.168.1.10:4000" />
          <button type="submit">Link</button>
        </form>
      </aside>
    );
  }

  const unplaced = link.scenes.filter((s) => !cueOf.has(s.id)).length;
  // cues whose scene cuemute no longer has
  const orphans = connected ? production.cues.filter((c) => !link.scenes.some((s) => s.id === c.scene)) : [];

  return (
    <aside className="cues-panel">
      <h3>cuemute</h3>
      <p className="hint link-url">
        {production.link.url}
        {production.link.show && ` · ${production.link.show}`}
      </p>
      {!connected && <p className="link-problem">{link.message || "Not connected"}</p>}
      <div className="toolbar">
        {connected && unplaced > 0 && <button onClick={autoPlace}>Place by Line / cue</button>}
        <button className="danger" onClick={unlink}>
          Unlink
        </button>
      </div>
      {connected && link.mode === "show" && (
        <p className="hint">cuemute is in Show mode. Switch it to Edit mode to add scenes from here.</p>
      )}

      {connected ? (
        <>
          <p className="hint">
            Select a scene, then a word in the script. {unplaced} of {link.scenes.length} not placed.
          </p>
          <ol className="scene-list">
            {link.scenes.map((s) => {
              const cue = cueOf.get(s.id);
              const classes = [
                s.id === selected && "selected",
                s.id === link.next && "next",
                s.id === link.current && "current",
                !cue && "unplaced",
              ];
              return (
                <li key={s.id} className={classes.filter(Boolean).join(" ")} onClick={() => onSelect(s.id === selected ? null : s.id)}>
                  <span className="num">{s.number || "–"}</span>
                  <span className="name">
                    {s.name || <em>Untitled</em>}
                    <span className="hint">{cue ? `…${cue.at.quote}` : s.lineRef ? `Not placed: ${s.lineRef}` : "Not placed"}</span>
                  </span>
                  {cue && (
                    <button
                      className="unplace"
                      title="Take this scene out of the script"
                      onClick={(e) => {
                        e.stopPropagation();
                        unplace(cue);
                      }}
                    >
                      ×
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
          {orphans.length > 0 && (
            <>
              <h4>Not in cuemute</h4>
              <p className="hint">cuemute no longer has these scenes.</p>
              <ul className="scene-list">
                {orphans.map((c) => (
                  <li key={c.id}>
                    <span className="num">{c.number || "–"}</span>
                    <span className="name">{c.name}</span>
                    <button className="unplace" onClick={() => unplace(c)}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      ) : (
        <p className="hint">The script still shows the {production.cues.length} placed cues, from when cuemute was last linked.</p>
      )}
    </aside>
  );
}
