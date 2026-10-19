# HTTP API

Anything that can send an HTTP request can run cuemute: Companion's **Generic HTTP Requests** module, a script, or another show control system. The [cuemute module for Companion](companion.md) uses this API too, and is the easier choice for a Stream Deck.

The examples below use Companion's Generic HTTP Requests module. Buttons set up this way don't show live state without polling.

## Before you start

- cuemute must listen on an address Companion can reach. Set `host` to the show machine's address on the show network, as in [Settings](settings.md). If Companion runs on the same machine, the default `127.0.0.1` works.
- In the examples below, cuemute is at `http://192.168.1.10:4000`. Use your own address.

## Set up the connection

1. In Companion, open **Connections**.
2. Add a **Generic: HTTP Requests** connection.
3. Set the base URL to `http://192.168.1.10:4000/api`.

## Add buttons

For each button, add a **POST** action on the HTTP connection with these settings:

| Button | URL | Body |
|---|---|---|
| GO | `/go` | none |
| Back | `/back` | none |
| Forward | `/forward` | none |
| Set the next scene | `/next/<scene id>` | none |
| Fire a scene | `/jump/<scene id>` | none |
| Mute channel 5 | `/channels/5/mute` | `{"muted": true}` |
| Unmute channel 5 | `/channels/5/mute` | `{"muted": false}` |
| Show mode | `/mode` | `{"mode": "show"}` |

For a request with a body, set the content type to `application/json`.

Scene ids are stable and do not change when you renumber or move a scene. To find a scene's id, open `http://192.168.1.10:4000/api/state` and look in `snapshot.show.scenes`.

GO, Back, Forward, setting the next scene, Jump, single-channel mute and mode changes all work in Show mode. Requests that change the show are refused in Show mode.

## Show the next scene on a button

`GET /api/state` returns flat fields that are simple to show on a button:

```json
{
  "mode": "show",
  "connected": true,
  "current": "2 Bakery",
  "currentGroup": "Act 1 Sc 2",
  "next": "2A Witch enters",
  "nextGroup": "Act 1 Sc 2",
  "nextLineRef": "p6 knock",
  "snapshot": { "...": "full state" }
}
```

Set the HTTP connection to poll `/state` and map `next` and `nextLineRef` to Companion variables. Then put `$(<connection>:next)` in a button's text. The exact settings for polling depend on your version of the HTTP module.

## Errors

An error returns a status code and a message:

| Status | Example message | Cause |
|---|---|---|
| 409 | `Desk not connected` | GO or a mute while the desk is offline. |
| 409 | `Switch to Edit mode to change the show` | An editing request in Show mode. |
| 404 | `No such scene` | A jump to a scene id that doesn't exist. |
| 400 | `No such channel` | A channel number the desk doesn't have. |

## Show library

| Method | Path | Mode | What it does |
|---|---|---|---|
| GET | `/api/shows` | Show, Edit | The show library folder, and each show's file, name, scene count and last change. |
| POST | `/api/shows/<file>/open` | Edit | Opens a show. Sends nothing to the desk. |
| GET | `/api/shows/<file>/export` | Show, Edit | Downloads a show file. |
