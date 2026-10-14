## cuemute

Runs a cuemute show from Companion: GO, Back, firing scenes, and single channel mutes. Buttons follow cuemute live, including mutes changed by hand on the desk.

Companion talks only to cuemute, never to the desk.

### Configuration

- **cuemute address**: the `host` cuemute listens on. Use `127.0.0.1` if cuemute runs on the same computer as Companion.
- **Port**: cuemute's port, `4000` unless you changed it.

### Actions

| Action | What it does |
|---|---|
| GO | Fires the next scene. |
| Back | Moves the next scene back one. Sends nothing to the desk. |
| Fire scene | Jumps to a scene and fires it. |
| Mute channel | Mutes, unmutes or toggles one channel. Not stored in any scene. |
| Show or Edit mode | Sets or toggles the mode. |

If cuemute refuses a command, for example GO while the desk is offline, the reason is in this connection's log.

### Feedbacks

| Feedback | On when |
|---|---|
| Channel is muted | The channel is muted on the desk. |
| Desk or cuemute not connected | GO would do nothing. |
| Show mode | cuemute is in Show mode. |
| Scene is current or next | The chosen scene is the last fired, or the next. |

### Variables

`show`, `mode`, `desk`, `current`, `current_number`, `current_name`, `next`, `next_number`, `next_name`, `next_line`, `next_notes`, and for each show channel `ch_N_name` and `ch_N_muted`.

### Presets

- **Show control**: GO showing the next scene's number, Back, the next scene with its line, a mode toggle, and the desk status.
- **Channels**: one button per show channel. Red when muted. Press to toggle.
- **Scenes**: one button per scene. Green when it is the last fired.

The scene and channel lists come from the show. They update when you edit the show in cuemute.
