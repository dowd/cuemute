# cuescript: design

Status: agreed, not started. Decided 21 October 2026.

cuescript is a text-based prompt book for theatre. It shows the script with every department's cues placed on the words they go on. It links to cuemute for radio mic mutes, and follows cuemute's live and next scenes during a show.

## Why a separate app

The first try, on the branch `feat/with-script`, built the script into cuemute. It works, but a prompt book holds cues for every department, notes, and later more, and that is more than cuemute's job of firing mute scenes from a cue list. As a separate app, cuescript can run without a desk or without cuemute, and a stage manager can use it on its own later.

Similar apps, for comparison:

| App | What it is | Difference from cuescript |
|---|---|---|
| Sound Script | iPad app for sound operators. PDF markup, Show Mode with a next-cue indicator. | Doesn't follow a show or link to a desk. PDF only. |
| StageWrite | iPad and web app for SMs, directors and LX. Blocking, cues and team sharing, by subscription. | No sound tools. |
| cuebook.co.uk | Free browser and desktop app. PDF markup with DCA and GO stamps and a show mode. | PDF only. No following, sync between screens, or desk link. |

cuescript is text-based, follows the show by itself, and knows which mute scene goes where.

## Users

- First: the radio mic operator, running cuemute.
- Possibly later: other departments, each seeing their own cues.

## Script and storage

- Import from Word (`.docx`), plain text (`.txt`) and Markdown (`.md`). Google Docs scripts come in through **File > Download > Microsoft Word**. PDF is out of scope, because placing cues by quoted text and carrying them across script versions needs real text.
- A production is one JSON file in a library folder. It saves on every change and keeps the version before as `.bak`, like cuemute's show library.
- The file has two parts:
    1. **Script.** Paragraphs, each with a stable id, a style (heading level, body, or page number), and runs of text with bold, italic and colour.
    2. **Cues and notes.** A separate list. Each item points at a paragraph id and a word in it, and keeps the quoted text so that it can be found again in a new version.
- The file keeps only the current script version. Importing a new version places cues again by their quoted text, and lists the cues it can't place.
- HTML is not the stored format. Cues inside HTML would make a new script version hard to merge, and imported HTML needs cleaning every time it shows. HTML and PDF are possible exports later.

## Cues

- Each production has a department list you can edit. It starts with Sound (mutes), LX, SFX, Fly and SM, each with a colour and a short code.
- A cue has a department, a number, a short label, a word position, and optional notes.
- A cue is placed on a word. The highlight covers the line it is in.
- cuescript shows cues. It doesn't fire them.
- Standbys are out of scope for now. Use a note.
- Annotations are text notes on a line. Highlights may come later. Freehand drawing is out of scope.

## Link to cuemute

- A production stores a cuemute address and the name of cuemute's show file. cuescript connects to cuemute's WebSocket.
- A mute cue stores a cuemute scene id, and a cached copy of the scene's number and name. If cuemute can't be reached or has a different show open, mute cues show from the cache, greyed out, with the reason.
- cuescript follows cuemute's live and next scenes. It never fires GO.
- **New scene here** creates a scene in cuemute at a line, and cuescript can set a scene's Line / cue. Both work only while cuemute is in Edit mode. Mutes are still set only in cuemute.
- cuescript changes cuemute only through cuemute's existing HTTP API. cuemute gets at most what the link needs, and doesn't know about cuescript.
- On import, cuescript places each mute cue on the last word of its scene's Line / cue quote, inside the paragraph. For example, `I will 'ave to 'ide!` places the cue on *'ide!*, before the stage direction after it. If a line appears more than once, the scenes before and after it decide which one. If that doesn't settle it, the cue stays unplaced. A Line / cue that describes a moment, such as `After song`, is placed by hand.
- cuemute owns the order of scenes. cuescript warns when a scene is out of script order, but never reorders cuemute's list.
- Without cuemute, the script is scrolled by hand. cuescript has no cue position of its own for now.

## Screens

- cuescript is a web app, served from a laptop to any browser on the show network, iPad included. Every screen stays in sync.
- During a show, cuemute and cuescript run side by side in two windows.
- Each screen chooses which departments it shows, and the browser remembers the choice.
- No login, like cuemute. The show network is the protection.

## Code and release

| Part | What it holds |
|---|---|
| `packages/script` | Shared: importing, matching quoted text, finding the speaker, the format for text runs. Starts from the reusable parts of `feat/with-script`. |
| `packages/cuescript-server` | The server, production library and cuemute link. |
| `packages/cuescript-web` | The web UI. |

- cuescript has its own binary and release asset next to cuemute's. Its default port is 4001.
- Its docs are a cuescript section in this docs site.
- `feat/with-script` is not merged, and stays for reference. cuemute keeps no script view and no anchors.

## Milestones

1. Import a script with its formatting, and read it on any screen.
2. Link to cuemute: follow live and next, place mute cues on words, and **New scene here**. This replaces what `feat/with-script` does.
3. Department cues and notes on lines.
4. A department filter for each screen.

## Hosting later

If cuescript works well, it may become a small hosted app for an amateur theatre company, free or very cheap to run. Nothing above rules this out. The decisions below keep it possible.

**Performances run locally.** A hosted server can't reach cuemute on the show network, and browsers block an `https://` page from opening a `ws://` connection to a local address. So the hosted copy is for preparation, rehearsals and sharing. A performance runs on a cuescript on the show laptop, linked to cuemute, with a copy of the production from the hosted app. This also keeps the show running when the venue has no internet. Moving a production between the two starts as export and import; sync can come later.

These rules apply from milestone 1:

- **Storage sits behind one interface.** The library folder is one implementation, with load, save and list. A database can replace it on a host with no lasting disk. One JSON document for each production fits a database row.
- **Productions have ids.** The HTTP API uses production ids, not file names.
- **Screens send small operations.** For example, "add cue" or "move cue", not "save the whole production". cuemute already works this way. This also helps if two people edit at once later.
- **Every change goes through the HTTP layer.** Then accounts and roles (editor, view only) can be added in one place later.

Hosting needs one always-on process, because the server holds the open production in memory and pushes changes over WebSockets. Fly.io, Railway or a small VPS fit. Serverless hosting doesn't.

Before a hosted copy holds scripts for more than one company, check the script licences. Licensed scripts often have terms about copying and distribution.

## Later

- Export to HTML and PDF.
- Highlights.
- Standbys.
- A cue position of cuescript's own, stepped with arrow keys or a pedal, for use without cuemute.
- Firing GO in cuemute from cuescript.
- A native iPad app.
- A hosted version, with accounts, export and import between hosted and local copies, and later sync. See [Hosting later](#hosting-later).
