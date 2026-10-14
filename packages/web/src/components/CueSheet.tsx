import { useState, type ReactNode } from "react";
import {
  describeChanges,
  groupRuns,
  micPlot,
  sheetChannels,
  type Channel,
  type GroupRun,
  type PlotCell,
  type Scene,
  type Snapshot,
} from "@cuemute/core";

type Layout = "list" | "plot";

// cue list columns, in print order
const COLUMNS = [
  { id: "num", label: "No." },
  { id: "name", label: "Scene" },
  { id: "line", label: "Line / cue" },
  { id: "changes", label: "Changes" },
  { id: "notes", label: "Notes" },
] as const;
type ColumnId = (typeof COLUMNS)[number]["id"];

interface Options {
  layout: Layout;
  tracked: boolean;
  columns: ColumnId[]; // shown in the cue list
  hidden: number[]; // channels left off the mic plot; new channels show by default
}

// Choices live in the URL, so a printed sheet can be reopened the same way.
function readOptions(): Options {
  const q = new URLSearchParams(location.search);
  const ids = COLUMNS.map((c) => c.id) as ColumnId[];
  const wanted = q.get("cols")?.split(",");
  const cols = wanted && ids.filter((id) => wanted.includes(id)); // always in print order
  return {
    layout: q.get("layout") === "plot" ? "plot" : "list",
    tracked: q.has("tracked"),
    columns: cols?.length ? cols : ids,
    hidden: (q.get("hide") ?? "").split(",").filter(Boolean).map(Number),
  };
}

function writeOptions(o: Options): void {
  const parts = ["print", `layout=${o.layout}`];
  if (o.tracked) parts.push("tracked");
  if (o.columns.length < COLUMNS.length) parts.push(`cols=${o.columns.join(",")}`);
  if (o.hidden.length) parts.push(`hide=${o.hidden.join(",")}`);
  history.replaceState(null, "", `?${parts.join("&")}`);
}

const channelLabel = (c: Channel) => c.name || `Ch ${c.number}`;
const sceneLabel = (number: string, i: number) => number || `${i + 1}`;

// A paper copy of the show: a cue list for the book, or a mic plot for the A1.
// Use the browser's print dialog to print it or save it as a PDF.
export function CueSheet({ snapshot }: { snapshot: Snapshot }) {
  const [options, setOptions] = useState(readOptions);
  const { layout, tracked, columns, hidden } = options;
  const { show } = snapshot;
  const allChannels = sheetChannels(show);
  const runs = groupRuns(show.scenes);

  const update = (patch: Partial<Options>) => {
    const next = { ...options, ...patch };
    setOptions(next);
    writeOptions(next);
  };
  const toggleColumn = (id: ColumnId) => {
    const on = columns.includes(id);
    if (on && columns.length === 1) return; // keep at least one
    update({ columns: COLUMNS.map((c) => c.id).filter((c) => (c === id ? !on : columns.includes(c))) });
  };
  const toggleChannel = (n: number) =>
    update({ hidden: hidden.includes(n) ? hidden.filter((h) => h !== n) : [...hidden, n] });

  return (
    <div className="cue-sheet">
      {/* landscape suits the wide mic plot; the browser applies this when printing */}
      {layout === "plot" && <style>{"@page { size: landscape; }"}</style>}

      <div className="sheet-controls">
        <div className="mode">
          <button className={layout === "list" ? "on" : ""} onClick={() => update({ layout: "list" })}>
            Cue list
          </button>
          <button className={layout === "plot" ? "on" : ""} onClick={() => update({ layout: "plot" })}>
            Mic plot
          </button>
        </div>
        {layout === "plot" && (
          <label className="check">
            <input type="checkbox" checked={tracked} onChange={(e) => update({ tracked: e.target.checked })} />
            Tracked state
          </label>
        )}
        <button className="primary" onClick={() => window.print()}>
          Print
        </button>
        <span className="hint">Use Save as PDF in the print dialog for a file.</span>
      </div>

      <div className="sheet-controls picker">
        {layout === "list" ? (
          <Picker title="Columns">
            {COLUMNS.map((c) => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={columns.includes(c.id)} onChange={() => toggleColumn(c.id)} />
                {c.label}
              </label>
            ))}
          </Picker>
        ) : (
          <Picker
            title="Channels"
            actions={
              <>
                <button onClick={() => update({ hidden: [] })}>All</button>
                <button onClick={() => update({ hidden: allChannels.map((c) => c.number) })}>None</button>
              </>
            }
          >
            {allChannels.map((c) => (
              <label key={c.number} className="check">
                <input type="checkbox" checked={!hidden.includes(c.number)} onChange={() => toggleChannel(c.number)} />
                {c.number} {channelLabel(c)}
              </label>
            ))}
          </Picker>
        )}
      </div>

      <div className="sheet-head">
        <h1>{show.name}</h1>
        <p>
          {layout === "list" ? "Cue list" : tracked ? "Mic plot, tracked state" : "Mic plot, changes only"} ·{" "}
          {show.scenes.length} scenes · printed {new Date().toLocaleString()}
        </p>
      </div>

      {show.scenes.length === 0 ? (
        <p>No scenes yet.</p>
      ) : layout === "list" ? (
        <CueList runs={runs} channels={allChannels} columns={columns} />
      ) : (
        <MicPlot snapshot={snapshot} runs={runs} channels={allChannels} hidden={hidden} tracked={tracked} />
      )}
    </div>
  );
}

function Picker({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <>
      <strong>{title}</strong>
      {actions && <span className="picker-actions">{actions}</span>}
      {children}
    </>
  );
}

function CueList({ runs, channels, columns }: { runs: GroupRun[]; channels: Channel[]; columns: ColumnId[] }) {
  const cell = (id: ColumnId, s: Scene, index: number) => {
    switch (id) {
      case "num":
        return (
          <td key={id} className="num" style={{ borderLeftColor: s.colour || "transparent" }}>
            {sceneLabel(s.number, index)}
          </td>
        );
      case "name":
        return <td key={id}>{s.name}</td>;
      case "line":
        return (
          <td key={id} className="line">
            {s.lineRef}
          </td>
        );
      case "changes":
        return <td key={id}>{describeChanges(s, channels) || <span className="none">No changes</span>}</td>;
      case "notes":
        return (
          <td key={id} className="notes">
            {s.notes}
          </td>
        );
    }
  };

  return (
    <table className="sheet cue-list">
      <thead>
        <tr>
          {COLUMNS.filter((c) => columns.includes(c.id)).map((c) => (
            <th key={c.id}>{c.label}</th>
          ))}
        </tr>
      </thead>
      {runs.map((r) => (
        <tbody key={r.start}>
          {r.group && (
            <tr className="group-row">
              <th colSpan={columns.length}>{r.group}</th>
            </tr>
          )}
          {r.scenes.map((s, i) => (
            <tr key={s.id}>{columns.map((id) => cell(id, s, r.start + i))}</tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

function MicPlot({
  snapshot,
  runs,
  channels,
  hidden,
  tracked,
}: {
  snapshot: Snapshot;
  runs: GroupRun[];
  channels: Channel[];
  hidden: number[];
  tracked: boolean;
}) {
  // state is tracked over every channel; hiding one only leaves out its column
  const plot = micPlot(snapshot.show.scenes, channels);
  const shown = channels.map((c, i) => ({ c, i })).filter(({ c }) => !hidden.includes(c.number));
  const cell = (c: PlotCell, key: number) => {
    const show = c.changed || (tracked && c.muted !== null);
    if (!show) return <td key={key} />;
    const classes = [c.muted ? "m" : "o", c.changed ? "changed" : "carried"].join(" ");
    return (
      <td key={key} className={classes}>
        {c.muted ? "M" : "O"}
      </td>
    );
  };

  return (
    <>
      <table className="sheet mic-plot">
        <thead>
          <tr>
            <th className="scene-col">Scene</th>
            {shown.map(({ c }) => (
              <th key={c.number} className="ch">
                <span>
                  {c.number} {channelLabel(c)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {runs.map((r) => (
          <tbody key={r.start}>
            {r.group && (
              <tr className="group-row">
                <th colSpan={shown.length + 1}>{r.group}</th>
              </tr>
            )}
            {r.scenes.map((s, i) => (
              <tr key={s.id}>
                <th className="scene-col" style={{ borderLeftColor: s.colour || "transparent" }}>
                  <b>{sceneLabel(s.number, r.start + i)}</b> {s.name}
                </th>
                {shown.map(({ i: col }) => cell(plot[r.start + i]![col]!, col))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
      <p className="legend">
        <b>M</b> muted · <b>O</b> on
        {tracked && " · bold: changed by this scene, grey: carried from earlier · blank: not set by any scene yet"}
      </p>
    </>
  );
}
