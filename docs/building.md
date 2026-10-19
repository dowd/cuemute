# Build and develop

This page is for working on cuemute itself. To use cuemute, download it as in [Install and start](install.md).

## Run from source

You need Node.js 22 or later, and the source code from the [cuemute repository](https://github.com/dowd/cuemute).

```sh
npm install
npm start
```

`npm start` builds the web UI and starts cuemute on <http://127.0.0.1:4000>. Run from source, cuemute reads `cuemute.json` from the cuemute folder, and keeps shows in its `shows/` folder.

## Build the single file

You need the source code set up as in [Run from source](#run-from-source), and an internet connection the first time.

```sh
npm run package
```

The command builds `dist/cuemute` for this machine. To build for another machine, name its target:

```sh
npm run package -- --target darwin-x64
```

The targets are `darwin-arm64` (Apple silicon Mac), `darwin-x64` (Intel Mac), `win-x64`, `linux-x64` and `linux-arm64`. A build for another target is `dist/cuemute-<target>`, with `.exe` for Windows.

The file is about 150 MB, because it contains Node. It starts from the official Node build from nodejs.org, of the same version as the Node that runs the command. The first build downloads that Node into `dist/node/` and checks it against the nodejs.org checksums. A Homebrew Node can't be used, because it loads shared libraries that other machines don't have.

## Publish a release

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

The HTTP API is described in [HTTP API](api.md). The Companion module is in `companion-module`, with its own `npm install`. It is not part of the workspace, and `companion-module/README.md` describes how to build it.

## Work on these docs

The docs are an [MkDocs](https://www.mkdocs.org) site with the Material theme, in the `docs` folder. You need Python 3.

1. Install MkDocs once:

    ```sh
    python3 -m venv .venv-docs
    .venv-docs/bin/pip install -r docs/requirements.txt
    ```

2. Serve the site with live reload:

    ```sh
    npm run docs
    ```

3. Open <http://127.0.0.1:8000>.

The screenshots come from the demo shows in `docs/demo`. To take them again after a change to the UI, run `npm run screenshots`. It uses the Google Chrome installed on your machine.

A push to `main` that changes the docs publishes the site to <https://dowd.github.io/cuemute/>, through the workflow `.github/workflows/docs.yml`. The workflow builds with `--strict`, so a broken link or a missing page stops the publish.
