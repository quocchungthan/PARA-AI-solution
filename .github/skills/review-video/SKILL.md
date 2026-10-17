---
name: review-video
description: Record observed web-review workflows with Playwright, prepare voice-ready narration, and optionally edit/export review videos with Concat or the portable local renderer.
---

# Review video workflow

Use this skill after identifying a safe test environment and completing a functional review. A recording is evidence of what the reviewer observed, not a substitute for the review record. Never fabricate UI states or narrate behavior that was not observed.

## Portable local recorder and renderer

The repository includes `tools/review-media`, independent of Concat:

1. Install Node.js 20+, FFmpeg (with `ffmpeg` and `ffprobe` on `PATH`), then run `npm ci --prefix tools/review-media` and `npm --prefix tools/review-media run install:browser` on a new machine. The package pins Playwright; the Chromium download is per user/machine and is not checked into Git.
2. Run `npm --prefix tools/review-media run doctor` to verify FFmpeg and the Playwright browser. It reports missing components rather than installing them.
3. Write a reviewed-flow ES module outside the repository. Export a default async function receiving `{ page, context, outputDir }`; use Playwright locators and assertions to perform the workflow. Keep sensitive content out of the page, console, screenshots and video. Reuse only explicitly approved test accounts. No authentication state is saved by this tool.
4. Record with `node tools/review-media/cli.mjs record --url https://test.example --flow /absolute/path/to/flow.mjs --out /absolute/new/output-directory`. Add `--headed` only when a visible browser is useful. Output directory must be new. The tool writes an MP4 per recorded page and `recording.json`; if a flow fails it preserves the available recording, marks it `failed`, and returns a failing exit code. Review it before sharing.
5. The renderer takes a JSON timeline with paths relative to that JSON file and cuts in seconds:

   ```json
   {
     "clips": [
       { "path": "capture/video.webm", "start": 0, "end": 12.5 },
       { "path": "extra.mp4", "start": 2, "end": 8 }
     ],
     "narration": "narration.wav"
   }
   ```

   `narration` is optional. Run `node tools/review-media/cli.mjs edit --timeline /absolute/path/timeline.json --out /absolute/new/review.mp4`. The local renderer normalizes picture to 1280x720, 30 fps H.264 and mixes the supplied narration audio, padding the audio to the cut length. It never synthesizes a voice or overwrites an output. If narration is longer than the footage, lengthen the edit rather than silently truncating speech. Use captions/titles, transitions, voice mixing, or other creative edits in Concat.

6. Keep review deliverables outside the repository as specified in the functional-reviewer agent instructions. Do not add recordings, narration, generated media, account data, model files, voice samples, or API tokens to Git. Review and delete transient data according to project policy.

## Concat: optional downstream editor

The upstream project is [jub0t/Concat](https://github.com/jub0t/Concat), a cross-platform native Rust editor (not a browser editor or Playwright plugin). The optional `third_party/Concat` submodule is pinned to v0.2.7. It is beta and licensed AGPL-3.0-or-later; the submodule preserves the upstream license and notices. It does not supply prebuilt binaries or AI model downloads.

To initialize the submodule in an existing clone, run `git submodule update --init --recursive`; for a fresh clone use `git clone --recurse-submodules`. The quickest way to run Concat is to install its [v0.2.7 release](https://github.com/jub0t/Concat/releases/tag/v0.2.7) for the machine's OS. To build the editor from the checked-out source, install Rust 1.93+, FFmpeg 7+ development libraries, CMake, and a C++ compiler (see [`third_party/Concat/src/README.md`](../../../third_party/Concat/src/README.md) for platform details), then run `cd third_party/Concat/src && cargo run -p concat`.

The pinned Concat source documents a JSON-RPC API (API version 0.2); its desktop GUI provides speech generation and reference-voice cloning. The checked-out source does not contain a verified callable TTS API method. For a custom voice, only use audio from a speaker with explicit permission. Concat's local speech models need disk space and local compute, and may be downloaded on first use. Choose a built-in voice where possible; if a cloud speech provider is later introduced, make it opt-in, disclose its cost and data handling, and use only a configured voice ID. No default provider, credentials, or paid service is bundled here.

For scriptable Concat editing, prefer the official JSON-RPC transport:

- The official source-checkout CLI accepts one JSON request or newline-delimited JSON-RPC via stdin: see [Concat JSON-RPC docs](https://concatenate.pages.dev/docs/transports/json-rpc/). The docs place `concat-cli` in a source checkout under `src/`; do not assume a release installer includes it. The documented build command is `cargo run -p concat-cli -- api ...` from Concat's `src/` directory.
- The installed desktop app can expose Remote control via Settings → Remote on `127.0.0.1:7420`. It requires an auth token as the first `auth` JSON-RPC request, including on loopback. Keep the listener on loopback, never expose it to a network, and store tokens outside Git. Anyone with the token can read files accessible to the app user's account; do not share it or include it in prompts, logs, or recordings.
- Call `version` first and inspect capabilities. Then use documented `project.create`/`open`, `media.import`, `edit.apply`, `project.save`, and `export.run`; wait for the matching `export.done` or `export.failed` event rather than treating job start as completion. Restrict file inputs and outputs to the intended review workspace and respect API write roots.
- A workflow with the desktop Remote socket may not manipulate the project already open in the GUI: the API uses separate project sessions. Confirm paths, project state, output and export completion before reporting success.
- To add narration made in Concat's GUI, export/save the WAV, review it, then import it into the project and arrange its audio track. This is a user-operated optional stage, not an automated capability of this repo's renderer.
- Do not treat `AdriGeorge/concatt-mcp` or another community bridge as first-party. The investigated adapter was unlicensed and pinned to Concat 0.2.6, so do not install/vendor it. The pinned v0.2.7 source advertises MCP in its README but its workspace has no verified MCP server crate; use the tested JSON-RPC helper unless upstream ships and documents a maintained transport.

This repo also includes a small optional client for the installed app's loopback JSON-RPC endpoint: `node tools/review-media/cli.mjs concat --timeline <timeline.json> --location <project-parent-under-api-root> --name <safe-name> --out <export-under-api-root.mp4>`. Set `CONCAT_API_TOKEN` in the local process environment; never put it in a command argument or saved project file. The helper calls `version` first, checks API 0.2, creates a fresh project, imports full video files in order on `T1`, optionally imports the narration file on `T2`, saves, starts the export, and waits for the matching completion event. Its Concat timeline format uses `clips` as an array of local file path strings (unlike the trimmed FFmpeg timeline). It rejects trimmed clips rather than silently ignoring edit points. Use the desktop UI for richer editing; the helper does not synthesize speech, add titles, or select effects. Review the output file and project before reporting success.

Concat projects, source media, and exports must be under the current user's home directory because that is the API's default write root. The helper only connects to loopback (`127.0.0.1` by default); set `CONCAT_API_PORT` or pass `--port` only when the local Remote endpoint uses a different port. It refuses an existing output file to avoid overwriting media. API-created projects are retained for review even if a later import or export step fails.

Useful official references: [Concat README and releases](https://github.com/jub0t/Concat), [system requirements and model sizes](https://concatenate.pages.dev/guides/system-requirements/), [API methods](https://concatenate.pages.dev/docs/api/methods/), [JSON-RPC security and authentication](https://concatenate.pages.dev/docs/transports/json-rpc/), and [MCP transport status](https://concatenate.pages.dev/docs/transports/mcp/).
