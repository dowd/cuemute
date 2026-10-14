import { useState } from "react";
import {
  describeChanges,
  groupRuns,
  micPlot,
  sheetChannels,
  type Channel,
  type GroupRun,
  type PlotCell,
  type Snapshot,
} from "@cuemute/core";

type Layout = "list" | "plot";

// Choices live in the URL, so a printed sheet can be reopened the same way.
function readOptions(): { layout: Layout; tracked: boolean } {
  const q = new URLSearchParams(location.search);
  return { layout: q.get("layout") === "plot" ? "plot" : "list", tracked: q.has("tracked") };
}

function writeOptions(layout: Layout, tracked: boolean): void {
  const q = new URLSearchParams({ print: "", layout });
  if (tracked) q.set("tracked", "");
  history.replaceState(null, "", `?${q.toString().replace(/=(&|$)/g, "$1")}`);
}

const channelLabel = (c: Channel) => c.name || `Ch ${c.number}`;
const sceneLabel = (number: string, i: number) => number || `${i + 1}`;

// A paper copy of the show: a cue list for the book, or a mic plot for the A1.
// Use the browser's print dialog to print it or save it as a PDF.
export function CueSheet({ snapshot }: { snapshot: Snapshot }) {
  const initial = readOptions();
  const [layout, setLayout] = useState<Layout>(initial.layout);
  const [tracked, setTracked] = useState(initial.tracked);
  const { show } = snapshot;
  const channels = sheetChannels(show);
  const runs = groupRuns(show.scenes);

  const choose = (l: Layout, t: boolean) => {
    setLayout(l);
    setTracked(t);
    writeOptions(l, t);
  };

  return (
    <div className="cue-sheet">
      {/* landscape suits the wide mic plot; the browser applies this when printing */}
      {layout === "plot" && <style>{"@page { size: landscape; }"}</style>}

      <div className="sheet-controls">
        <div className="mode">
          <button className={layout === "list" ? "on" : ""} onClick={() => choose("list", tracked)}>
            Cue list
          </button>
          <button className={layout === "plot" ? "on" : ""} onClick={() => choose("plot", tracked)}>
            Mic plot
          </button>
        </div>
        {layout === "plot" && (
          <label className="check">
            <input type="checkbox" checked={tracked} onChange={(e) => choose(layout, e.target.checked)} />
            Tracked state
          </label>
        )}
        <button className="primary" onClick={() => window.print()}>
          Print
        </button>
        <span className="hint">Use Save as PDF in the print dialog for a file.</span>
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
        <CueList runs={runs} channels={channels} />
      ) : (
        <MicPlot snapshot={snapshot} runs={runs} channels={channels} tracked={tracked} />
      )}
    </div>
  );
}

function CueList({ runs, channels }: { runs: GroupRun[]; channels: Channel[] }) {
  return (
    <table className="sheet cue-list">
      <thead>
        <tr>
          <th>No.</th>
          <th>Scene</th>
          <th>Line / cue</th>
          <th>Changes</th>
          <th>Notes</th>
        </tr>
      </thead>
      {runs.map((r) => (
        <tbody key={r.start}>
          {r.group && (
            <tr className="group-row">
              <th colSpan={5}>{r.group}</th>
            </tr>
          )}
          {r.scenes.map((s, i) => (
            <tr key={s.id}>
              <td className="num" style={{ borderLeftColor: s.colour || "transparent" }}>
                {sceneLabel(s.number, r.start + i)}
              </td>
              <td>{s.name}</td>
              <td className="line">{s.lineRef}</td>
              <td>{describeChanges(s, channels) || <span className="none">No changes</span>}</td>
              <td className="notes">{s.notes}</td>
            </tr>
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
  tracked,
}: {
  snapshot: Snapshot;
  runs: GroupRun[];
  channels: Channel[];
  tracked: boolean;
}) {
  const plot = micPlot(snapshot.show.scenes, channels);
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
            {channels.map((c) => (
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
                <th colSpan={channels.length + 1}>{r.group}</th>
              </tr>
            )}
            {r.scenes.map((s, i) => (
              <tr key={s.id}>
                <th className="scene-col" style={{ borderLeftColor: s.colour || "transparent" }}>
                  <b>{sceneLabel(s.number, r.start + i)}</b> {s.name}
                </th>
                {plot[r.start + i]!.map(cell)}
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
