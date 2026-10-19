# Settings

cuemute works without any settings. To change where it listens or where it keeps shows, make a settings file called `cuemute.json`.

## Where the settings file goes

| How you run cuemute | Folder for `cuemute.json` |
|---|---|
| The downloaded file, on a Mac | `~/Library/Application Support/cuemute` |
| The downloaded file, on Windows | `%APPDATA%\cuemute` |
| The downloaded file, on Linux | `~/.config/cuemute` |
| From the source code, with `npm start` | The cuemute folder |

When it starts, cuemute prints the folder it reads settings from.

## Example

```json
{
  "host": "192.168.1.10",
  "port": 4000,
  "shows": "~/Dropbox/Shows"
}
```

Every setting is optional. If the file has a mistake, cuemute stops and names the setting at fault.

## Settings

| Setting | Default | Purpose |
|---|---|---|
| `host` | `127.0.0.1` | The network address to listen on. Use the show machine's address on the desk network, so iPads and Companion can connect. Avoid `0.0.0.0`, which also listens on the venue Wi-Fi. |
| `port` | `4000` | The port in the address, as in `http://127.0.0.1:4000`. |
| `shows` | `shows` | The show library: the folder that holds the show files. A path that doesn't start with `/` or `~` is relative to the settings file. |
| `show` | None | A show file to open at every start, in place of the last show opened. If you set `show` and not `shows`, the show library is the folder that holds this file. |

The desk type, IP address and MIDI channel aren't settings. They are saved in each show, so they travel with it. See [Connect a desk](connect.md).

## Environment variables

An environment variable overrides the matching setting for one run:

| Variable | Overrides |
|---|---|
| `HOST` | `host` |
| `PORT` | `port` |
| `CUEMUTE_SHOWS` | `shows` |
| `CUEMUTE_SHOW` | `show` |
| `CUEMUTE_CONFIG` | Reads the settings file at this path, in place of `cuemute.json`. |

For example, to try a different port once:

```sh
PORT=4100 ./cuemute
```

If cuemute can't start, it says why:

- **This Mac has no address …**: `host` isn't an address of this machine. cuemute lists the addresses it has.
- **Port 4000 is in use**: cuemute is probably already running. If not, set a different `port`.
