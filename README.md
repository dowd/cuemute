# cuemute

Channel mutes for theatre, run from a cue list. Each scene mutes or unmutes the channels it lists, and leaves every other channel alone. The app reads live mute state back from the desk.

Supported desks: Allen & Heath Qu and SQ, and a simulated desk for programming without hardware. See [docs/spec.md](docs/spec.md) for the design.

## Run a show

You need Node.js 22 or later.

1. Install the dependencies:

   ```sh
   npm install
   ```

2. Start cuemute:

   ```sh
   npm start
   ```

3. Open <http://127.0.0.1:4000>.

By default cuemute listens on this Mac only, and keeps the show in `shows/show.json`. To change this, set these variables before `npm start`:

| Variable | Default | Purpose |
|---|---|---|
| `HOST` | `127.0.0.1` | The network interface to listen on. Use the Mac's address on the desk network, for example `192.168.1.10`, so iPads and Companion can connect. Avoid `0.0.0.0`, which also listens on venue Wi-Fi. |
| `PORT` | `4000` | The HTTP port. |
| `CUEMUTE_SHOW` | `shows/show.json` | The show file. Each save keeps the previous version as `<file>.bak`. |

```sh
HOST=192.168.1.10 CUEMUTE_SHOW=~/Shows/woods.json npm start
```

For a backstage screen that can't press GO or edit, open the address with `?view` on the end, for example `http://192.168.1.10:4000/?view`.

## Connect a Qu

1. On the Qu, connect the network port to the same network as the Mac.
2. In cuemute, switch to **Edit** mode.
3. Open the **Desk** tab.
4. Choose **Allen & Heath Qu** and enter the desk's IP address.
5. Select **Connect**.

cuemute reads every input's mute state from the desk, and picks up the desk's MIDI channel by itself. The Qu accepts only one MIDI connection at a time, so close A&H MIDI Control and any Companion module that talks to the desk directly.

## Connect an SQ

1. On the SQ, open **Utility > General > MIDI** and note the MIDI channel.
2. Connect the SQ's network port to the same network as the Mac.
3. In cuemute, switch to **Edit** mode.
4. Open the **Desk** tab.
5. Choose **Allen & Heath SQ**.
6. Enter the desk's IP address and the MIDI channel from step 1.
7. Select **Connect**.

cuemute asks the SQ for each input's mute, which takes under a second. If the desk doesn't answer, the MIDI channel in cuemute doesn't match the desk. The SQ can't send channel names over MIDI, so type the names in the **Channels** tab.

## Program a show

1. In **Edit** mode, open the **Channels** tab and add the channels the show manages, with your own names. Leave band and effects channels out: cuemute never touches them. With a Qu, **Import names from desk** copies the desk's names into this list.
2. Add scenes with **Add scene**, or set the mutes on the desk and select **Record**. Record makes a new scene from the channels that changed since the last GO.
3. For each scene, set each channel to **–** (leave alone), **Mute** or **On**.

## Run the show

| Action | How |
|---|---|
| Fire the next scene | **GO**, or Space |
| Move the next pointer back | **Back**. This sends nothing. |
| Fire any scene | Double-click it |
| Preview a scene on the grid | Click it |
| Mute or unmute one channel | Click its tile on the grid |

Switch to **Show** mode before the performance. Show mode hides editing on every screen.

If the desk disconnects, GO is disabled until it comes back. On reconnect cuemute reads the desk again and sends nothing, so check the grid before the next GO.

## Develop

```sh
npm run dev        # server on 4000 with reload, UI on http://localhost:5173
npm test           # all tests
npm run typecheck
```

The code is an npm workspace:

| Package | Contents |
|---|---|
| `packages/core` | Show model and scene logic. No I/O. |
| `packages/consoles` | The `Console` interface, the simulated desk, and the Qu and SQ drivers. |
| `packages/server` | Engine, HTTP API, WebSocket and show file. |
| `packages/web` | React UI. |

The HTTP API is described in [docs/companion.md](docs/companion.md).
