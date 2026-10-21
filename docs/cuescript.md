# cuescript

cuescript is a prompt book that shows the show's script on any screen, with each cuemute scene marked on the word it goes on. During the show it follows cuemute's live and next scenes. It is in development: cues for other departments come next. [cuescript: design](cuescript-design.md) has the plan.

## Start cuescript

You need Node.js 22 or later, and the cuemute repo with `npm install` done.

```sh
npm run start:cuescript
```

Then open <http://127.0.0.1:4001>. cuescript has no single-file build yet.

## Add a production

A production holds one show's script, and later its cues and notes.

1. Select **New production**.
2. Type the show's name, and confirm.

To rename a production, select its name at the top of the page.

## Import the script

1. Download the script as a Word file. In Google Docs, select **File > Download > Microsoft Word (.docx)**.
2. Open the production.
3. Select **Import script…** and choose the file.

cuescript keeps the script's headings, bold, italics, text colours, highlights and page numbers. A plain text (`.txt`) or Markdown (`.md`) file also works: each line is a paragraph, and a line that starts with `#` is a heading.

The list on the left shows the script's acts and scenes. Select one to go to it. Every screen that has the production open shows the new script as soon as you import it.

## Link to cuemute

cuescript gets its mute cues from cuemute. cuemute stays in charge of the scenes and their mutes, and cuescript never fires GO.

1. In cuemute, open the show for this production.
2. In cuescript, open the production and select **Cues**.
3. Type cuemute's address, for example `192.168.1.10:4000`, and select **Link**.

cuescript links to the show that cuemute has open now. It then places each scene by its **Line / cue**, on the last word of the quoted text. If a line appears more than once, for example `Felix!`, the scenes before and after it decide which one it is. If that doesn't settle it, the scene stays unplaced. A **Line / cue** that describes a moment, such as `After song`, is placed by hand.

The link is open while a screen has the production open. If cuemute isn't running, or has a different show open, the header says so, and the script still shows the cues from when cuemute was last linked.

## Place mute cues

The **Cues** panel lists cuemute's scenes in cuemute's order. A yellow number means the scene isn't placed yet. Each screen opens and closes its own **Cues** panel, and words can only be picked while it is open, so a screen that follows the show never changes a cue by a stray tap.

To place a scene, or move it:

1. Select the scene in the **Cues** panel.
2. Select the word in the script that the cue goes on.
3. Select **Place … here**.

If the scene has no **Line / cue** in cuemute, it gets the words that end at the cue, while cuemute is in Edit mode.

To add a scene at a word, select the word and then **New scene here**. cuemute must be in Edit mode. The new scene goes into cuemute's list in script order, with the words that end at the cue as its **Line / cue**. Set its mutes in cuemute.

**×** next to a scene takes it out of the script. **Place by Line / cue** tries again for every scene that isn't placed, for example after you change a **Line / cue** in cuemute.

## Follow the show

While cuemute is linked, the script keeps the next scene's line a third of the way down. The next scene's line is green, and the live scene's line is blue. If the next scene isn't placed, the script stays at the last placed scene before it. The strip at the top always names the live and next scenes.

If you scroll the script, it stops following. Select **Follow cues** to start again.

## Import a new version of the script

Select **Import new version…**. cuescript finds each cue again by the words that end at it, so cues stay in place when lines move. If those words were cut or changed, the cue is dropped, and its scene shows as not placed. While cuemute is linked, cuescript then tries those scenes again by their **Line / cue**.

## Move a production to another computer

1. In the production, select **Export**. This saves the production, script included, as a `.cuescript.json` file.
2. On the other computer, select **Import…** in the production list, and choose the file.

An imported production is a new copy. It never replaces a production already there.

## Settings

Environment variables change where cuescript listens and keeps productions. They have their own names, so cuescript and cuemute can run from the same shell.

| Variable | Default | What it sets |
|---|---|---|
| `CUESCRIPT_HOST` | `127.0.0.1` | The address to listen on. Use `0.0.0.0` to let iPads and other computers on the network connect. |
| `CUESCRIPT_PORT` | `4001` | The port to listen on. |
| `CUESCRIPT_PRODUCTIONS` | `productions` in the repo | The folder that holds production files, one per production, each with a `.bak` of the version before. |

## Work on cuescript

```sh
npm run dev:cuescript
```

This runs the server on port 4001 and the UI with live reload on <http://localhost:5174>. The code is in `packages/script` (the script format and importer, shared), `packages/cuescript-server` and `packages/cuescript-web`.
