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
| Forward | Moves the next scene on one, skipping a scene. Sends nothing to the desk. |
| Set next scene | Makes a scene the one GO fires next. Sends nothing to the desk. |
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

`show`, `mode`, `desk`, `current`, `current_number`, `current_name`, `current_group`, `next`, `next_number`, `next_name`, `next_group`, `next_line`, `next_notes`, and for each show channel `ch_N_name` and `ch_N_muted`.

### Presets

- **Show control**: GO showing the next scene's number, Back, Forward, the next scene with its line, the next cue line on its own, a mode toggle, and the desk status.

The **Next cue line** preset suits the Stream Deck Neo's info strip. In Companion the strip is the wide place in the bottom row, second column. Drag the preset there. The strip can't be pressed, so the preset has no actions. It turns red when GO won't work.
- **Channels**: one button per show channel. Red when muted. Press to toggle.
- **Scenes**: one button per scene that fires it, in a section per scene group. Green when it is the last fired.
- **Set next**: one button per scene that makes it next without firing it. Amber when it is next.

The scene and channel lists come from the show. They update when you edit the show in cuemute.
