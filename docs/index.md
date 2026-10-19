# cuemute

cuemute runs radio mic mutes for theatre from a cue list. You build a list of scenes, and each scene says which channels to mute and which to turn on. During the show you press **GO** and cuemute sends that scene's mutes to the desk.

It works with Allen & Heath **Qu** and **SQ** desks, and has a simulated desk so you can program a show without hardware. It runs in a web browser, on the Mac that runs the show and on any iPad or laptop on the same network. A Stream Deck can run it through Bitfocus Companion.

![cuemute in Show mode, part way through The Tempest](images/show-mode.png)

## How cuemute works

**A scene stores only what it changes.** Scene 4 in the picture above says "Ariel on", and nothing else. Every other channel stays as it is. So a channel that no scene mentions is never touched: a band mic or a late addition to the cast needs no edits to the scenes you already have.

**Mutes go first.** When a scene both mutes and opens channels, cuemute sends the mutes first. Two actors swapping a mic are never open at the same time.

**You always see what GO will do.** The large panel shows the next scene, with its cue line. The grid under it shows every channel. A channel the next scene changes is split in two: its state now on the left, and after GO on the right.

**cuemute reads the desk.** The grid shows what the desk is really doing, including changes made by hand on the desk. If a scene would set a channel to the state it is already in, the tile says "already", which usually means someone changed it on the desk.

**There are two modes.** In **Edit** mode you program the show. In **Show** mode the editing tools are hidden on every screen, so nothing changes by accident during a performance.

## Where to start

| To | Read |
|---|---|
| Get cuemute running | [Install and start](install.md) |
| Connect a Qu or SQ | [Connect a desk](connect.md) |
| Build your scenes | [Program a show](program.md) |
| Run a performance | [Run a show](run.md) |
| Keep more than one show | [Manage shows](shows.md) |
| Print a cue list or mic plot | [Print a cue sheet](cue-sheet.md) |
| Use a Stream Deck | [Stream Deck and Companion](companion.md) |

To try cuemute without a desk, download the demo show [tempest.json](demo/tempest.json) and import it on the **Shows** tab. It uses the simulated desk.
