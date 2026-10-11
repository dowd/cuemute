# cuemute: design spec

cuemute runs channel mutes for theatre from a cue list. An operator steps through scenes with GO. Each scene mutes or unmutes a set of channels on the mixing desk. The app reads live mute state back from the desk where the protocol allows it.

Status: agreed design, before any code. Allen & Heath Qu is the first target desk, then SQ.

## Goals

- A channel added late (a new band mic, for example) needs no edits to existing scenes.
- The operator sees what the next scene will do before pressing GO.
- Scenes are faster to edit than desk scenes.
- More than one screen can view and run the show, including from a Stream Deck through Bitfocus Companion.

## Non-goals

These are out of scope for the first version. Some are deferred, not rejected.

- Fader levels, EQ, or any parameter other than mutes.
- DCA assignment, and showing mutes caused by a DCA or mute group (deferred).
- Tracking cue lists, where a jump sends the full computed state (deferred, see [Jumps](#jumps)).
- Desks other than Qu and SQ. The `Console` interface allows more later.

## Scenes

A scene stores only the changes it makes. It does not store a full snapshot of the desk.

```ts
type Target = { kind: "input"; number: number }; // later: "dca", "muteGroup"

interface Change {
  target: Target;
  muted: boolean;
}

interface Scene {
  id: string;        // stable internal id
  number: string;    // free text label, e.g. "12A"
  name: string;
  lineRef: string;   // line or cue reference the operator reads, e.g. "p34 'Is that you?'"
  notes: string;
  colour: string;
  changes: Change[];
}
```

- The order of scenes is their position in the list. `number` is a label only, because theatre numbers such as "12A" or "12.5" do not sort reliably. The app warns about duplicate numbers.
- A channel that no scene mentions is never touched. This is what makes a late band mic free: leave it out of every scene.
- Firing a scene sends its changes to the desk, mutes first and unmutes second, so two swapped mics are never open at the same time.

### Jumps

A jump fires only the changes stored in the target scene. It does not apply the scenes in between.

Tracking is a possible later setting. With tracking on, a jump would compute the state at the target scene by applying every scene from the top, then send the difference from live state. To keep this cheap to add, scenes stay pure change lists, and "compute the state at scene N" is a separate pure function in `core`.

## Channels

The show file holds its own channel list, with names chosen by the operator (often character names, not desk labels).

When connected to a Qu, the operator can import channel names from the desk as a one-off action. The app does not keep names in sync. SQ cannot send names over MIDI, so on SQ names are always typed in the app.

Targets use `{ kind, number }` so DCA mutes and mute groups can be added later as new kinds. The first version supports `input` only.

## Operation

| Action | Behaviour |
|---|---|
| GO, or space bar | Fires the next scene and moves the cursor on. |
| Back | Moves the cursor back one scene. Sends nothing. |
| Click a scene | Selects it: the grid previews it, and in Edit mode the editor opens it. Sends nothing. |
| Double-click a scene | Jumps to it and fires it (see [Jumps](#jumps)). Double, so a stray click mid-show can't change the desk. |
| Mute or unmute one channel | Sends one change to the desk. Available from the UI and the API. It is not stored in any scene. |

The desk shows a single channel change made through the app as live state, the same as a change made by hand on the desk.

### Show and Edit modes

The server holds the mode, and every connected screen follows it.

- **Edit mode:** scenes, channels and settings can be changed.
- **Show mode:** editing is hidden on every screen. The API accepts only operational calls: GO, Back, Jump, and single channel mute.

If two screens edit at the same time, the last save wins. This is acceptable for one programmer.

### Desk disconnection

- GO is refused while the desk is disconnected. Every screen shows a red banner.
- On reconnect, the app reads the live state from the desk again and sends nothing. The operator checks the grid and fires a scene again if needed.

The app never sends queued or repeated mutes on its own, because unexpected mutes in a live show open mics by surprise.

## Desk feedback

### Live grid

The main view shows the show's channels with their live mute state. The next scene's changes appear over the grid as arrows (muted to unmuted, or the reverse). A change that will have no effect, because the channel is already in that state, is dimmed. This usually means someone changed the desk by hand, which the operator wants to see before GO.

The grid shows each channel's own mute. A channel silenced by a DCA or mute group shows as unmuted. This is a known limit of the first version.

### Record

Record captures a new scene from the desk.

1. The app compares the desk's live state now with the state at the moment of the last GO.
2. Channels that differ, and that are in the show's channel list, become the new scene's changes.
3. The new scene goes after the current one, and the operator can edit its changes.

Channels outside the show's list are ignored, so band channels never enter a scene by accident.

## Companion and the API

Bitfocus Companion drives the Stream Deck. Companion talks only to cuemute, never to the desk, because the Qu accepts only one TCP MIDI connection.

The HTTP API (proposed shape):

| Method | Path | Mode | Purpose |
|---|---|---|---|
| POST | `/api/go` | Show, Edit | Fire the next scene. |
| POST | `/api/back` | Show, Edit | Move the cursor back. |
| POST | `/api/jump/:sceneId` | Show, Edit | Jump to a scene and fire it. |
| POST | `/api/channels/:number/mute` | Show, Edit | Body `{ "muted": true }`. Mute or unmute one channel. |
| GET | `/api/state` | Show, Edit | Current and next scene, mode, connection state. For Companion variables. |

Browsers use a WebSocket for live state and for editing. The server is the only source of truth, and every browser is a view of it.

## Architecture

TypeScript monorepo with npm workspaces:

```
packages/
  core/      show model, scene logic, state computation. Pure, no I/O.
  consoles/  Console interface, plus sim, qu, and later sq drivers.
  server/    Fastify, WebSocket, HTTP API, show file storage, console connection.
  web/       React UI, built with Vite.
```

Dependency rule: `core` imports nothing from `consoles` or `server`. This keeps all scene logic testable without a desk.

### Console interface

```ts
interface Console {
  connect(host: string): Promise<void>;
  disconnect(): void;
  setMute(target: Target, muted: boolean): void;
  readonly state: "disconnected" | "connecting" | "connected";
  // emitted for changes from the desk and for the connect-time read
  on(event: "mute", cb: (target: Target, muted: boolean) => void): void;
  on(event: "state", cb: (state: Console["state"]) => void): void;
  on(event: "synced", cb: () => void): void;
  // optional, Qu only
  readChannelNames?(): Promise<Map<number, string>>;
}
```

The simulated console (`sim`) keeps mute state in memory. It is built first, and it is both the test harness and the way to program a show without a desk.

### Show file

One JSON file per show, with a `schemaVersion` field. The server saves on every change and keeps a backup copy of the previous version. JSON is simple to diff, copy between machines, and repair by hand.

### Testing

Vitest. Protocol tests feed the byte examples printed in the Allen & Heath protocol documents through each driver, the same approach used in OpenMix's `test_allenheath_midi.cpp`.

### Running

`npm start` starts the server and serves the UI. The server binds to one chosen network interface so it does not listen on venue Wi-Fi. There is no login. An optional view-only link serves backstage screens. A packaged app is possible later.

## Desk protocols

Both desks use MIDI over TCP on port 51325.

### Qu (first)

Reference: [Qu MIDI Protocol V1.9](https://www.allen-heath.com/content/uploads/2023/06/Qu_MIDI_Protocol_V1.9.pdf).

- Mute: Note On, note = channel number, velocity 40–7F mutes and 01–3F unmutes, then a Note Off. Velocity 00 and Note Off are ignored. Inputs 1–32 are channels `20`–`3F`.
- On connect, send Get System State with the All Call header and iPad flag 0: `F0 00 00 1A 50 11 01 00 7F 10 00 F7`. The reply (`…0N 11 <BoxID> <Major> <Minor> F7`) gives the desk's MIDI channel N. The desk then pushes its state, and `…0N 14 F7` marks the end of the sync.
- Names: get `…0N 01 CH F7`, reply `…0N 02 CH <ascii> F7`.
- The desk sends Active Sensing (`FE`) about every 300 ms. If the desk receives `FE` from us, it closes the connection after 12 seconds without data.
- The DAW fader strips use MIDI channel N+1. Ignore that channel, or strip keys read as mutes.
- The desk accepts only one TCP MIDI connection at a time.

### SQ (second)

Reference: [SQ MIDI Protocol Issue 4](https://www.allen-heath.com/content/uploads/2023/05/SQ-MIDI-Protocol-Issue4.pdf).

- Mute: NRPN `BN 63 00 BN 62 <ch-1> BN 06 00 BN 26 <01 on / 00 off>`. Inputs 1–48.
- Get: `BN 63 MB BN 62 LB BN 60 7F`. The desk replies with the NRPN. There is no bulk sync, so read each channel on connect, paced.
- The desk's MIDI channel cannot be read, so the operator sets it in the app.
- There are no channel names over MIDI.
- The doc's "LR Mute" get example (p18) uses `00 00`, which the reference table lists as Input 1. LR mute is `00 44`.

## Build order

1. `core`, with tests.
2. Simulated console.
3. Server: API, WebSocket, show file.
4. React UI.
5. Qu driver, ported from the OpenMix parser and tested against the doc's byte examples.
6. Record.
7. Companion setup.
8. SQ driver.

## Open items

- Whether the Qu sends a fresh state push after Get System State with iPad flag 0 on port 51325. The doc implies it, but this is not yet tested on a desk.
- Whether the Qu echoes mute changes that the app sends. The driver must handle an echo without reporting drift.
- Whether some screens should be view-only for GO as well as for editing.
