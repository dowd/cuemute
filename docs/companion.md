# Control cuemute from Companion

Bitfocus Companion drives a Stream Deck by sending HTTP requests to cuemute. Companion never talks to the desk itself, because the Qu accepts only one MIDI connection.

There are two ways to set this up:

- **The cuemute module** (recommended). Buttons update live, lists show scene and channel names, and presets build a page for you. See [companion-module/README.md](../companion-module/README.md).
- **Generic HTTP Requests**, described on this page. It needs no install, but buttons don't show live state without polling.

## Before you start

- cuemute must listen on an address Companion can reach. Start it with `HOST` set to the Mac's address on the show network. If Companion runs on the same Mac, the default `127.0.0.1` works.
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
| Fire a scene | `/jump/<scene id>` | none |
| Mute channel 5 | `/channels/5/mute` | `{"muted": true}` |
| Unmute channel 5 | `/channels/5/mute` | `{"muted": false}` |
| Show mode | `/mode` | `{"mode": "show"}` |

For a request with a body, set the content type to `application/json`.

Scene ids are stable and do not change when you renumber or move a scene. To find a scene's id, open `http://192.168.1.10:4000/api/state` and look in `snapshot.show.scenes`.

GO, Back, Jump, single-channel mute and mode changes all work in Show mode. Requests that change the show are refused in Show mode.

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
