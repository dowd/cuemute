# cuescript

cuescript is a prompt book that shows the show's script on any screen. It is in development: today it imports a script and shows it. Placing cues and the link to cuemute come next. [cuescript: design](cuescript-design.md) has the plan.

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

To change to a new version of the script, select **Import new version…**.

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
