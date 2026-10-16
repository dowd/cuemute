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

By default cuemute listens on this Mac only, on port 4000, and keeps shows in the `shows/` folder. It reopens the show you had open last.

### Change the settings

To change the settings, make a file called `cuemute.json` in the cuemute folder. `cuemute.example.json` is a starting point:

```json
{
  "host": "192.168.1.10",
  "port": 4000,
  "shows": "~/Dropbox/Shows"
}
```

| Setting | Default | Purpose |
|---|---|---|
| `host` | `127.0.0.1` | The network interface to listen on. Use the Mac's address on the desk network so iPads and Companion can connect. Avoid `0.0.0.0`, which also listens on venue Wi-Fi. |
| `port` | `4000` | The HTTP port. |
| `shows` | `shows/` | The show library: the folder that holds the show files. A relative path is relative to the config file. |
| `show` | None | A show file to open at every start, in place of the last show opened. If you set `show` and not `shows`, the show library is the folder that holds this file. |

Every setting is optional. `cuemute.json` is not committed to git, so each machine can have its own.

An environment variable overrides the matching setting in the file for one run:

| Variable | Overrides |
|---|---|
| `HOST` | `host` |
| `PORT` | `port` |
| `CUEMUTE_SHOWS` | `shows` |
| `CUEMUTE_SHOW` | `show` |
| `CUEMUTE_CONFIG` | Reads a config file at another path, in place of `cuemute.json`. |

```sh
CUEMUTE_CONFIG=~/Shows/venue.json npm start
```

If the config file has a mistake, cuemute stops and names the setting at fault.

The desk type, IP address and MIDI channel are not in the config file. They are saved in the show file when you select **Connect**, so they travel with the show.

For a backstage screen that can't press GO or edit, open the address with `?view` on the end, for example `http://192.168.1.10:4000/?view`.

### Run the single-file build

`dist/cuemute` is one file that holds Node, the server and the web UI. The Mac that runs it needs nothing else installed. To make it, see [Build the single file](#build-the-single-file).

1. Copy `cuemute` to the Mac that runs the show.
2. Start it from Terminal:

   ```sh
   ./cuemute
   ```

3. Open <http://127.0.0.1:4000>.

The single file keeps its settings and shows in the app data folder, not beside the file:

| Platform | Folder |
|---|---|
| macOS | `~/Library/Application Support/cuemute` |
| Windows | `%APPDATA%\cuemute` |
| Linux | `~/.config/cuemute` |

Put `cuemute.json` in that folder to change the settings. The settings and environment variables are the same as above. The default show library is `shows/` in that folder. When it starts, cuemute prints the settings folder, the show library and the show file it uses.

If you copy the file to another Mac by AirDrop, a download or a USB stick, macOS blocks the first run. Right-click the file, select **Open**, then confirm. macOS remembers this for that copy.

## Build the single file

You need the repo set up as in [Run a show](#run-a-show), and an internet connection the first time.

```sh
npm run package
```

The command builds `dist/cuemute` for this machine. To build for another machine, name its target:

```sh
npm run package -- --target darwin-x64
```

The targets are `darwin-arm64` (Apple silicon Mac), `darwin-x64` (Intel Mac), `win-x64`, `linux-x64` and `linux-arm64`. A build for another target is `dist/cuemute-<target>`, with `.exe` for Windows.

The file is about 150 MB, because it contains Node. It starts from the official Node build from nodejs.org, of the same version as the Node that runs the command. The first build downloads that Node into `dist/node/` and checks it against the nodejs.org checksums. A Homebrew Node can't be used, because it loads shared libraries that other machines don't have.

### Publish a release

The GitHub Actions workflow `.github/workflows/release.yml` builds the single file for every target, and the Companion module. It runs on a macOS runner, because the Mac builds need `codesign`.

To publish a release, push a tag that starts with `v`:

```sh
git tag v0.2.0
git push origin v0.2.0
```

The workflow runs the type check and the tests, builds the files, and attaches them to a new GitHub release:

- `cuemute-<version>-<target>.tar.gz` for macOS and Linux, and `.zip` for Windows. Each holds the `cuemute` file, which keeps its executable bit.
- `cuemute-<module version>.tgz`, the Companion module, to import in Companion.

To get the files without a release, run the workflow from the **Actions** tab with **Run workflow**. The files are on the run's page, under **Artifacts**.

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

## Open, save and move shows

cuemute saves every change to the open show straight away, so there is no Save button. The **Shows** tab in **Edit** mode lists every show in the show library:

| To | Do this |
|---|---|
| Start a show | Select **New show** and type a name. The new show uses the same desk settings as the open show. |
| Switch shows | Select **Open** on a show. |
| Save a copy under a new name | Select **Duplicate** on a show. The copy opens. |
| Copy a show to another machine | Select **Export** to download the show file. On the other machine, select **Import…** and pick the file. The imported show opens. |
| Delete a show | Open another show first, then select **Delete**. cuemute deletes the show file and its backup. |

Opening a show sends nothing to the desk. No scene is live, and the first scene is next, so the desk changes only when you press GO. If the show names a different desk, cuemute connects to that desk. Every screen and Companion switch to the opened show.

Each show is one JSON file, named after the show when you make it. Renaming a show doesn't rename its file. Each save keeps the previous version as `<file>.bak`.

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
| Move the next pointer back | **Back**, or ← |
| Skip a scene | **Forward**, or →. Stops at the last scene. |
| Choose the next scene | In Show mode, click it. In Edit mode, select it and choose **Set as next**. |
| Fire any scene | Double-click it |
| Select a scene to edit | Click it, in Edit mode |

Back, Forward and choosing the next scene send nothing to the desk. They only change which scene GO fires next. GO then carries on from that scene.
| Mute or unmute one channel | Click its tile on the grid |

The grid always shows the next scene. A channel it will change shows its state now on the left half and after GO on the right. A dashed border with "already" means the scene sets a state the channel is already in, which usually means someone changed it on the desk by hand.

Switch to **Show** mode before the performance. Show mode hides editing on every screen.

If the desk disconnects, GO is disabled until it comes back. On reconnect cuemute reads the desk again and sends nothing, so check the grid before the next GO.

## Print a cue sheet

Select **Cue sheet** at the top of the screen. It opens in a new tab with two layouts:

- **Cue list**: one row per scene, under its group, with the line, what the scene mutes and opens, and notes.
- **Mic plot**: scenes down the side and channels across the top, with **M** (muted) or **O** (on). By default it shows only what each scene changes. Turn on **Tracked state** to show every channel's state after each scene: the scene's own changes are bold, and states carried from earlier are grey. A channel is blank until the first scene that sets it.

To choose what prints, use the checkboxes under the layout buttons: **Columns** for the cue list, and **Channels** for the mic plot, for example to leave out the band. Hiding a channel only removes its column; tracked state still counts every scene. New channels are included until you untick them. Your choices are kept in the page address, so bookmark it to reuse them.

Choose the paper size (**A4** or **US Letter**) and **Portrait** or **Landscape** next to the layout buttons. The sheet starts on A4, with the cue list in portrait and the mic plot in landscape. The print dialog follows these choices, so set them here rather than in the dialog.

Select **Print**. To get a PDF, choose **Save as PDF** in the print dialog.

The sheet follows the show live, so edits appear on it straight away.

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
