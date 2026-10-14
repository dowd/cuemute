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

By default cuemute listens on this Mac only, on port 4000, and keeps the show in `shows/show.json`.

### Change the settings

To change the settings, make a file called `cuemute.json` in the cuemute folder. `cuemute.example.json` is a starting point:

```json
{
  "host": "192.168.1.10",
  "port": 4000,
  "show": "~/Shows/woods.json"
}
```

| Setting | Default | Purpose |
|---|---|---|
| `host` | `127.0.0.1` | The network interface to listen on. Use the Mac's address on the desk network so iPads and Companion can connect. Avoid `0.0.0.0`, which also listens on venue Wi-Fi. |
| `port` | `4000` | The HTTP port. |
| `show` | `shows/show.json` | The show file. A relative path is relative to the config file. Each save keeps the previous version as `<file>.bak`. |

Every setting is optional. `cuemute.json` is not committed to git, so each machine can have its own.

An environment variable overrides the matching setting in the file for one run:

| Variable | Overrides |
|---|---|
| `HOST` | `host` |
| `PORT` | `port` |
| `CUEMUTE_SHOW` | `show` |
| `CUEMUTE_CONFIG` | Reads a config file at another path, in place of `cuemute.json`. |

```sh
CUEMUTE_CONFIG=~/Shows/venue.json npm start
```

If the config file has a mistake, cuemute stops and names the setting at fault.

The desk type, IP address and MIDI channel are not in the config file. They are saved in the show file when you select **Connect**, so they travel with the show.

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

1. In **Edit** mode, select the show name at the top left to rename the show.
2. Open the **Channels** tab and add the channels the show manages, with your own names. Leave band and effects channels out: cuemute never touches them. With a Qu, **Import names from desk** copies the desk's names into this list.
3. Add scenes with **Add scene**, or set the mutes on the desk and select **Record**. Record makes a new scene from the channels that changed since the last GO.
4. For each scene, set each channel to **–** (leave alone), **Mute** or **On**.
5. To group scenes, for example the sub-scenes of one script scene, give them the same **Group**. Neighbouring scenes in a group show under one heading. A new or recorded scene takes the group of the scene before it. **Rename** on a group heading renames it on every scene that has it.

Select a group heading to collapse it. The group with the live, next or selected scene always stays open. Each screen remembers its own collapsed groups.

## Run the show

| Action | How |
|---|---|
| Fire the next scene | **GO**, or Space |
| Move the next pointer back | **Back**. This sends nothing. |
| Fire any scene | Double-click it |
| Preview a scene on the grid | Click it |
| Mute or unmute one channel | Click its tile on the grid |

## Print a cue sheet

Select **Cue sheet** at the top of the screen. It opens in a new tab with two layouts:

- **Cue list**: one row per scene, under its group, with the line, what the scene mutes and opens, and notes.
- **Mic plot**: scenes down the side and channels across the top, with **M** (muted) or **O** (on). By default it shows only what each scene changes. Turn on **Tracked state** to show every channel's state after each scene: the scene's own changes are bold, and states carried from earlier are grey. A channel is blank until the first scene that sets it.

Select **Print**. To get a PDF, choose **Save as PDF** in the print dialog. The mic plot prints in landscape.

The sheet follows the show live, so edits appear on it straight away.

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

The HTTP API is described in [docs/companion.md](docs/companion.md). The Companion module is in [companion-module](companion-module/README.md), with its own `npm install`; it is not part of the workspace.
