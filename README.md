# cuemute

cuemute runs radio mic mutes for theatre from a cue list. You build a list of scenes, and each scene says which channels to mute and which to turn on. During the show you press **GO**, and cuemute sends that scene's mutes to the desk.

![cuemute in Show mode](docs/images/show-mode.png)

- **A scene stores only what it changes.** A channel no scene mentions is never touched, so a band mic or a late cast change needs no edits to existing scenes.
- **You see what GO will do.** The grid shows every channel's state now, and after GO for each channel the next scene changes.
- **It reads the desk.** Mutes changed by hand on the desk show on the grid straight away.
- **It runs anywhere on the network.** Use it in a browser on the show Mac, an iPad, or a backstage screen, and from a Stream Deck through Bitfocus Companion.
- **It prints.** A cue list for the book, and a mic plot with tracked state.

It supports Allen & Heath **Qu** and **SQ** desks, and has a simulated desk for programming without hardware.

## Get started

1. Download cuemute for your machine from the [releases page](https://github.com/dowd/cuemute/releases), and unpack it.
2. Start it. On a Mac, open Terminal in the folder that holds it and run `./cuemute`.
3. Open <http://127.0.0.1:4000>.
4. Switch to **Edit** mode, open the **Desk** tab, and connect your desk.

The first start on a Mac needs **Open Anyway** in **System Settings > Privacy & Security**. [Install and start](docs/install.md) has the details, including how to use cuemute from an iPad.

## Documentation

The full guide is at **<https://dowd.github.io/cuemute/>**. The same pages are in the [docs](docs/index.md) folder:

| To | Read |
|---|---|
| Get cuemute running | [Install and start](docs/install.md) |
| Connect a Qu or SQ | [Connect a desk](docs/connect.md) |
| Build your scenes | [Program a show](docs/program.md) |
| Run a performance | [Run a show](docs/run.md) |
| Keep more than one show | [Manage shows](docs/shows.md) |
| Print a cue list or mic plot | [Print a cue sheet](docs/cue-sheet.md) |
| Use a Stream Deck | [Stream Deck and Companion](docs/companion.md) |
| Change where cuemute listens or keeps shows | [Settings](docs/settings.md) |
| Work on cuemute | [Build and develop](docs/building.md) |

To work on the docs, see [Work on these docs](docs/building.md#work-on-these-docs).

## Run from source

You need Node.js 22 or later.

```sh
npm install
npm start
```

Then open <http://127.0.0.1:4000>. [Build and develop](docs/building.md) covers the single-file build, releases and tests.
