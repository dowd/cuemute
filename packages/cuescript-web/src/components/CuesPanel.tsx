import { useEffect, useState } from "react";
import { MUTES, type Department, type DeptCue, type LinkState, type MuteCue, type Note, type ProductionView } from "@cuemute/script";
import { api } from "../api.ts";
import { cueLabel, type Selection } from "../cues.ts";
import type { Run } from "../useRun.ts";

interface Props {
  production: ProductionView;
  link: LinkState;
  // each paragraph's position in the script, to list cues in script order
  paragraphIndex: Map<string, number>;
  selection: Selection;
  onSelect: (s: Selection) => void;
  onNotice: (message: string) => void;
  run: Run;
}

type Tab = "mutes" | "cues" | "departments";

// Placing and editing cues: cuemute's scenes, the other departments' cues and
// notes, and the department list. Select an item here or in the script, then
// a word in the script.
export function CuesPanel(props: Props) {
  const { selection } = props;
  const [tab, setTab] = useState<Tab>("mutes");
  // selecting a cue or note in the script shows it here
  useEffect(() => {
    if (selection?.kind === "cue" || selection?.kind === "note") setTab("cues");
    if (selection?.kind === "scene") setTab("mutes");
  }, [selection?.kind, selection?.id]);

  return (
    <aside className="cues-panel">
      <div className="tabs">
        {(["mutes", "cues", "departments"] as const).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "mutes" ? "Mutes" : t === "cues" ? "Cues" : "Departments"}
          </button>
        ))}
      </div>
      {tab === "mutes" && <MutesTab {...props} />}
      {tab === "cues" && <CuesTab {...props} />}
      {tab === "departments" && <DepartmentsTab {...props} />}
    </aside>
  );
}

// The link to cuemute and its scenes.
function MutesTab({ production, link, selection, onSelect, onNotice, run }: Props) {
  const [address, setAddress] = useState(production.link?.url ?? "http://127.0.0.1:4000");
  const path = `/productions/${encodeURIComponent(production.id)}`;
  const mutes = production.cues.filter((c): c is MuteCue => c.kind === "mute");
  const cueOf = new Map(mutes.map((c) => [c.scene, c]));
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

  const unplace = (cue: MuteCue) => run(() => api("DELETE", `${path}/cues/${encodeURIComponent(cue.id)}`));

  if (!production.link) {
    return (
      <>
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
      </>
    );
  }

  const unplaced = link.scenes.filter((s) => !cueOf.has(s.id)).length;
  // cues whose scene cuemute no longer has
  const orphans = connected ? mutes.filter((c) => !link.scenes.some((s) => s.id === c.scene)) : [];

  return (
    <>
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
              const isSel = selection?.kind === "scene" && selection.id === s.id;
              const classes = [isSel && "selected", s.id === link.next && "next", s.id === link.current && "current", !cue && "unplaced"];
              return (
                <li
                  key={s.id}
                  className={classes.filter(Boolean).join(" ")}
                  onClick={() => onSelect(isSel ? null : { kind: "scene", id: s.id })}
                >
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
        <p className="hint">The script still shows the {mutes.length} placed scenes, from when cuemute was last linked.</p>
      )}
    </>
  );
}

// The other departments' cues and the notes, in script order, with an editor
// for the selected one. Items a new script version lost come first.
function CuesTab({ production, paragraphIndex, selection, onSelect, run }: Props) {
  const path = `/productions/${encodeURIComponent(production.id)}`;
  const order = (at: { paragraph: string; word: number } | null) =>
    at ? (paragraphIndex.get(at.paragraph) ?? 0) * 100_000 + at.word : -1;
  type Item = { kind: "cue"; item: DeptCue } | { kind: "note"; item: Note };
  const items: Item[] = [
    ...production.cues.filter((c): c is DeptCue => c.kind === "cue").map((item) => ({ kind: "cue" as const, item })),
    ...production.notes.map((item) => ({ kind: "note" as const, item })),
  ].sort((a, b) => order(a.item.at) - order(b.item.at));
  const unplaced = items.filter((x) => !x.item.at).length;

  const selected = items.find((x) => x.kind === selection?.kind && x.item.id === selection.id);

  return (
    <>
      {selected ? (
        selected.kind === "cue" ? (
          <CueEditor key={selected.item.id} cue={selected.item} production={production} onSelect={onSelect} run={run} />
        ) : (
          <NoteEditor key={selected.item.id} note={selected.item} path={path} onSelect={onSelect} run={run} />
        )
      ) : (
        <p className="hint">Select a word in the script to add a cue or a note there. Select a cue or note to change it.</p>
      )}
      {unplaced > 0 && (
        <p className="link-problem">
          {unplaced} not placed: a new script version lost their words. Select one, then a word, and choose Move here.
        </p>
      )}
      <ol className="scene-list">
        {items.map((x) => {
          const isSel = x.kind === selection?.kind && x.item.id === selection.id;
          const dept = x.kind === "cue" ? production.departments.find((d) => d.id === x.item.department) : null;
          return (
            <li
              key={x.item.id}
              className={[isSel && "selected", !x.item.at && "unplaced"].filter(Boolean).join(" ")}
              onClick={() => onSelect(isSel ? null : { kind: x.kind, id: x.item.id })}
            >
              <span className="num" style={{ color: dept?.colour }}>
                {x.kind === "cue" ? cueLabel(x.item, production.departments) : "Note"}
              </span>
              <span className="name">
                {x.kind === "cue" ? x.item.label || <em>No label</em> : x.item.text || <em>Empty</em>}
                <span className="hint">{x.item.at ? `…${x.item.at.quote}` : "Not placed"}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {items.length === 0 && <p className="hint">No cues or notes yet.</p>}
    </>
  );
}

// Fields save when they lose focus, as in cuemute's scene editor.
function CueEditor({ cue, production, onSelect, run }: { cue: DeptCue; production: ProductionView; onSelect: Props["onSelect"]; run: Run }) {
  const path = `/productions/${encodeURIComponent(production.id)}/cues/${encodeURIComponent(cue.id)}`;
  const [draft, setDraft] = useState({ number: cue.number, label: cue.label, notes: cue.notes });
  const save = (field: keyof typeof draft) => {
    if (draft[field] !== cue[field]) run(() => api("PATCH", path, { [field]: draft[field] }));
  };
  const remove = () => {
    if (!confirm(`Delete ${cueLabel(cue, production.departments)}?`)) return;
    run(async () => {
      await api("DELETE", path);
      onSelect(null);
    });
  };
  return (
    <div className="editor">
      <div className="row">
        <label>
          Department
          <select value={cue.department} onChange={(e) => run(() => api("PATCH", path, { department: e.target.value }))}>
            {production.departments
              .filter((d) => d.id !== MUTES)
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Number
          <input value={draft.number} onChange={(e) => setDraft({ ...draft, number: e.target.value })} onBlur={() => save("number")} />
        </label>
      </div>
      <label>
        Label
        <input value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} onBlur={() => save("label")} />
      </label>
      <label>
        Notes
        <textarea rows={2} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} onBlur={() => save("notes")} />
      </label>
      <div className="toolbar">
        <span className="hint">To move it, select a word, then Move here.</span>
        <button className="danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

function NoteEditor({ note, path, onSelect, run }: { note: Note; path: string; onSelect: Props["onSelect"]; run: Run }) {
  const url = `${path}/notes/${encodeURIComponent(note.id)}`;
  const [text, setText] = useState(note.text);
  const remove = () =>
    run(async () => {
      await api("DELETE", url);
      onSelect(null);
    });
  return (
    <div className="editor">
      <label>
        Note
        <textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => text !== note.text && run(() => api("PATCH", url, { text }))}
        />
      </label>
      <div className="toolbar">
        <span className="hint">To move it, select a word, then Move here.</span>
        <button className="danger" onClick={remove}>
          Delete
        </button>
      </div>
    </div>
  );
}

// The department list. Changes save with Save.
function DepartmentsTab({ production, run, onNotice }: Props) {
  const [list, setList] = useState<Department[]>(production.departments);
  const changed = JSON.stringify(list) !== JSON.stringify(production.departments);
  const set = (i: number, patch: Partial<Department>) => setList(list.map((d, j) => (j === i ? { ...d, ...patch } : d)));

  const add = () => {
    let n = list.length;
    while (list.some((d) => d.id === `dept-${n}`)) n++;
    setList([...list, { id: `dept-${n}`, name: "", code: "", colour: "#4aa3df" }]);
  };

  const save = () =>
    run(async () => {
      await api("PUT", `/productions/${encodeURIComponent(production.id)}/departments`, list);
      onNotice("Departments saved.");
    });

  return (
    <>
      <p className="hint">The code shows with each cue number, such as LX 14. A department that has cues can&apos;t be deleted.</p>
      <table className="departments">
        <tbody>
          {list.map((d, i) => (
            <tr key={d.id}>
              <td>
                <input type="color" value={d.colour} onChange={(e) => set(i, { colour: e.target.value })} aria-label="Colour" />
              </td>
              <td>
                <input value={d.name} onChange={(e) => set(i, { name: e.target.value })} aria-label="Name" placeholder="Name" />
              </td>
              <td>
                {d.id === MUTES ? (
                  <span className="hint">cuemute</span>
                ) : (
                  <input
                    className="code"
                    value={d.code}
                    maxLength={8}
                    onChange={(e) => set(i, { code: e.target.value })}
                    aria-label="Code"
                    placeholder="Code"
                  />
                )}
              </td>
              <td>
                {d.id !== MUTES && (
                  <button className="unplace" title="Delete" onClick={() => setList(list.filter((_, j) => j !== i))}>
                    ×
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="toolbar">
        <button onClick={add}>Add department</button>
        <button disabled={!changed} onClick={save}>
          Save
        </button>
        {changed && (
          <button onClick={() => setList(production.departments)} title="Undo the changes not saved">
            Undo
          </button>
        )}
      </div>
    </>
  );
}
