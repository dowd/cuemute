# Stream Deck and Companion

[Bitfocus Companion](https://bitfocus.io/companion) runs a Stream Deck. The cuemute module for Companion gives you GO, Back and scene buttons that follow the show live: a button shows the next scene's number, and channel buttons turn red when the channel is muted, including mutes changed on the desk.

Companion only talks to cuemute, never to the desk.

You need Companion 5.0 or later.

## Install the module

1. Download `cuemute-<version>.tgz` from the [cuemute releases page](https://github.com/dowd/cuemute/releases). It is the Companion module, not cuemute itself.
2. In Companion, open **Modules**.
3. Select **Import module package**, and choose the file.
4. Open **Connections** and add a **cuemute** connection.
5. Set **cuemute address** and **Port**. If Companion runs on the same machine as cuemute, use `127.0.0.1` and `4000`.

If Companion runs on another machine, cuemute must listen on the show network. See [Use cuemute from an iPad or another computer](install.md#use-cuemute-from-an-ipad-or-another-computer).

To update the module, import the new file in the same way.

## Build a page with presets

The fastest way to fill a Stream Deck page is to drag presets from the cuemute connection onto buttons:

| Preset section | Buttons |
|---|---|
| **Show control** | GO, which shows the next scene's number. Back, Forward, the next scene with its cue line, the next cue line on its own, a Show/Edit mode toggle, and the desk status. |
| **Channels** | One button per show channel. Red when muted. Press to mute or unmute. |
| **Scenes** | One button per scene that fires it, in a section per group. Green when it is the last scene fired. |
| **Set next** | One button per scene that makes it next without firing it. Amber when it is next. |

The scene and channel buttons come from the open show, and update when you edit it.

On a Stream Deck Neo, drag the **Next cue line** preset to the info strip. In Companion the strip is the wide space in the bottom row, second column. The strip can't be pressed, so the preset has no actions. It turns red when GO won't work.

## Actions

| Action | What it does |
|---|---|
| GO | Fires the next scene. |
| Back | Moves NEXT back one scene. Sends nothing to the desk. |
| Forward | Moves NEXT on one scene, skipping a scene. Sends nothing to the desk. |
| Set next scene | Makes a scene the one GO fires next. Sends nothing to the desk. |
| Fire scene | Jumps to a scene and fires it. |
| Mute channel | Mutes, unmutes or toggles one channel. Not stored in any scene. |
| Show or Edit mode | Sets or toggles the mode. |

If cuemute refuses a command, for example GO while the desk is disconnected, the reason is in the connection's log in Companion.

## Feedbacks

| Feedback | On when |
|---|---|
| Channel is muted | The channel is muted on the desk. |
| Desk or cuemute not connected | GO would do nothing. |
| Show mode | cuemute is in Show mode. |
| Scene is current or next | The chosen scene is the last fired, or the next. |

## Variables

Use these in button text, for example `$(cuemute:next_number)`:

| Variable | Contents |
|---|---|
| `show` | The show name. |
| `mode` | `show` or `edit`. |
| `desk` | The desk status. |
| `current`, `current_number`, `current_name`, `current_group` | The last scene fired. |
| `next`, `next_number`, `next_name`, `next_group`, `next_line`, `next_notes` | The next scene. |
| `ch_N_name`, `ch_N_muted` | Channel N's name, and whether it is muted. |

## Without the module

Companion's **Generic HTTP Requests** module can also send commands to cuemute. Buttons then can't show live state. See [HTTP API](api.md).
