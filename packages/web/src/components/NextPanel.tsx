import type { Snapshot } from "@cuemute/core";

// What the operator reads while waiting for the cue.
export function NextPanel({ snapshot }: { snapshot: Snapshot }) {
  const next = snapshot.show.scenes.find((s) => s.id === snapshot.cursor.next);
  if (!next) {
    return (
      <div className="next-panel end">
        <span className="label">NEXT</span> End of cue list
      </div>
    );
  }
  return (
    <div className="next-panel" style={{ borderLeftColor: next.colour || undefined }}>
      <div>
        <span className="label">NEXT</span>
        <span className="num">{next.number}</span>
        <span className="name">{next.name}</span>
      </div>
      {next.lineRef && <div className="line">{next.lineRef}</div>}
      {next.notes && <div className="notes">{next.notes}</div>}
    </div>
  );
}
