# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A single-page, static HTML survey tool for validating 3D sign language animation data. Participants watch MP4 videos and answer two questions per video:
1. **"What is signed in the video?"** — free-text input
2. **"What is the quality of the animation?"** — 1–5 Likert scale (Very Low → Very High)

Responses are submitted to a Google Apps Script endpoint as JSON via a `no-cors` POST.

## Running the Survey

Open `index.html` directly in a browser — no build step, no server required. If videos fail to load due to browser security restrictions, serve it locally:

```bash
python -m http.server 8080
# then open http://localhost:8080
```

## Architecture

Everything lives in a single `index.html` file. Key state variables at the top of the `<script>` block:

- `videoIds` — array of relative MP4 paths loaded from a JSON file
- `responses` — parallel array storing each round's answer/rating
- `currentRound` / `totalRounds` — index and count

Flow: **user-info screen** → fetch JSON → shuffle `videoIds` → **video + questions loop** → **final/submit page**.

## Data Layout

```
data/
  paths_1-100.json          # array of "./data/seygin/<id>.mp4" paths
  make_json.py              # generates paths_*.json by chunking mp4 files in 100s
  seygin/
    animations/
      original/             # raw animation captures (named like "Take 2025-09-05...")
      rename/               # anonymised copies (8-char random IDs, e.g. 13sHyB0D.mp4)
      map.txt               # TSV: original_name → new_name
    videos/
      original/             # reference sign language videos (BIM — Bahasa Isyarat Malaysia)
      rename/               # anonymised copies
      map.txt               # TSV: original_name → new_name
```

The JSON files in `data/` reference the `rename/` files (anonymised IDs) so that the original sign labels are not leaked to participants.

## Adding More Video Batches

1. Place anonymised MP4s in `data/seygin/` (or run `make_json.py` after populating `rename/`).
2. Run `python data/make_json.py` from inside the `data/` directory to regenerate `paths_*.json` chunks.
3. Uncomment the corresponding `<option>` entries in `index.html`'s `#dataset-select` dropdown.

## Google Sheets Integration

The submission URL is hardcoded in `submitToGoogleSheets()` (line 365 of `index.html`). Each response object sent contains: `name`, `dataset`, `round`, `file`, `answer`, `rating`.
