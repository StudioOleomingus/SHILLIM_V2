# Shillim Institute Archive — Codebase Map

> Last updated: 2026-06-29. Reflects the hexagonal 6-category system, the
> animator/creature modules, the tutorial + archive-panel overlays, the shared
> `shilim.css`, and the per-artist project pages under `assets/PROJECT-PAGES/`.

## Overview

This is an interactive archive website for the **Shillim Institute**, an organization in the Western Ghats (India) that sponsors art residencies, conservation fellowships, mapping workshops, and community programs. The website is built with **PixiJS v8** (WebGL-based 2D rendering) and uses a novel interaction model: users draw rectangular selections on a grid, the direction of their drag determines which project category is selected, and when enclosed regions form on the grid, matching projects appear in a sidebar panel. Animated creatures (ants, beetles, lizards, frogs, ladybugs, caterpillars) wander the canvas as the user paints. The site also has a standard searchable project index, individual per-artist project pages, and admin CRUD interfaces.

The site deploys to **Netlify** (with serverless functions) and also has a local Express dev server.

---

## Architecture Diagram

```
index.html (Landing Page / PixiJS App)
  |
  |-- shilim.css ............. Shared stylesheet for ALL HTML pages (fonts, layout, mobile overlay)
  |-- MobileCreatures.js ..... Standalone (non-module) creature spawner for the mobile redirect card
  |
  |-- Config.js ............. Global constants, PIXI app instance, grid config, project data loader
  |-- App.js ................. Initializes the PIXI renderer, attaches canvas to DOM
  |-- Resources.js ........... Loading screen, downloads 6 zip texture packs, loads UI textures
  |     |                      Shows intro → loading bar → "CONTINUE" → inits sections + tutorial
  |     |
  |-- ImageSection.js ........ Core interactive grid — drag-to-paint mechanic
  |     |                      Determines category by drag direction (6 hexagonal directions)
  |     |                      Detects "surrounded" empty cell groups → triggers project reveals
  |     |-- Tutorial.js ....... Floating onboarding overlay (messages + GIF demos), gates early steps
  |     |-- LizardAnimator.js . Spawns ant/beetle/lizard sprites from enclosed groups
  |     |-- Transitions.js .... Shared GSAP slide-in/out cascade helpers (also used elsewhere)
  |     |-- Utils.js .......... getRandomSelectionRect()
  |
  |-- InfoSection.js ......... Left sidebar — "ARCHIVE INDEX" + scrollable project card list
  |     |-- ProjectCard.js .... Card factory + detail window
  |     |     |-- Transitions.js
  |     |     |-- LadybugAnimator.js . Ladybug that crawls a card on hover/open
  |     |-- ArchivePanel.js ... Full-screen in-app archive browser overlay
  |     |     |-- CaterpillarAnimator.js . Canvas-overlay caterpillar inside the panel
  |     |-- FrogAnimator.js ... Frog burst-crawl animation
  |
  |-- BottomLayout.js ........ Category proportion bar + text description box
  |
projectindex.html ............ Standalone searchable/filterable index page (uses shilim.css)
  |                            Fetches data/projects.json, renders cards with thumbnails
  |                            Filter by category (ART/COMMUNITY/ECOLOGY/RESEARCH/HEALTH/EDUCATION)
  |
projectpage.html ............. Generic individual project detail page (fallback template)
  |                            Per-artist copies live in assets/PROJECT-PAGES/<Name>/projectpage.html
  |
admin.html ................... Admin panel (Netlify serverless backend)
admin-local.html ............. Admin panel (local Express backend)
admin-projectpage.html ....... Admin panel for per-project page content
  |
server.js .................... Local Express dev server (port 3001)
netlify/functions/projects.js  Netlify serverless equivalent of server.js
netlify.toml ................. Netlify deploy config — redirects /api/projects → function
```

---

## File-by-File Breakdown

### Core JavaScript Modules (ES Modules)

| File | Purpose | Key Exports |
|---|---|---|
| **Config.js** | Central configuration. Creates the PIXI.Application. Defines grid params, 6 categories (ART, COMMUNITY, ECOLOGY, RESEARCH, HEALTH, EDUCATION), drag-direction enums, color palettes, folder paths for the 6 texture packs. Loads `data/projects.json` on init. | `app`, `TextureArray`, `GridCell`, `gridCells`, `projects`, `DragDirection`, `PLAIN_COLORS`, `interactiveRect`, `projectType`, `projectDescriptionTexts`, etc. |
| **App.js** | Initializes the PIXI renderer with antialiasing, appends the canvas to `#app-container`, handles window resize. | `initApp()` |
| **Resources.js** | Loading/intro sequence. Downloads 6 ZIP files (one per category) of pre-sliced tile PNGs via JSZip into `TextureArray[cat][row][col]`. Loads UI textures (background, RESET, HELP, PLUS, decorative leaves/dragonfly/frog, etc.). Shows progress bar then "CONTINUE", which inits the three sections, Transitions, and the Tutorial. | `LoadTextures()`, texture vars |
| **ImageSection.js** | The core interactive canvas. Users drag rectangles on the grid; drag angle (360° → 6 hexagonal sectors) selects which category texture is painted. `TextureStats` tracks per-direction fill percentages and flood-fills to detect "surrounded" empty groups; a new group adds a matching project card (via `window.addRandomProject(...)` with the 6 hexagonal percentages) and spawns a creature near the enclosure. Restart button, keyboard audio (keys 1/2/3), rounded-corner masking. | `initImageSection()` |
| **InfoSection.js** | Left sidebar (300px). "ARCHIVE INDEX" button opens the in-app `ArchivePanel`. Scrollable project-card container with GSAP momentum. `addRandomProject()` matches projects against current category percentages (primary + secondary). Hosts a FrogAnimator. | `initInfoSection()`, `archiveIndexValueLabelText` |
| **BottomLayout.js** | Bottom bar of 6 colored sections sized to each category's grid fill percentage, plus a text box showing project/category descriptions when groups are found. | `initBottomLayout()`, `updateSectionSizes()`, `updateTextBox()` |
| **ProjectCard.js** | Factory for PIXI project cards (title, author, date, expand button). Detail window with scrollable description + project-page link. Single-open-at-a-time. Uses Transitions and a hover ladybug. | `createProjectCard()` |
| **ArchivePanel.js** | Full-screen in-app archive overlay opened from the sidebar's "ARCHIVE INDEX". Builds a DOM panel + backdrop, renders projects, and runs a canvas caterpillar. An in-page alternative to navigating to `projectindex.html`. | `openArchivePanel()`, `closeArchivePanel()` |
| **Tutorial.js** | Floating onboarding overlay. Sequenced instructional messages each with an optional GIF (`assets/UI-ELEMENTS/tutorial/*.gif`). Gates early interaction until the user picks a category, paints, and encloses a region. | `startTutorial()`, `tutorialDragDone()`, `tutorialSurroundDone()`, `isTutorialBlocking()` |
| **Transitions.js** | Shared GSAP cascade motions for PixiJS containers (slide in/out from left/right, page-in) with common easing/duration constants. | `slideInFromRight/Left`, `slideOutToRight/Left`, `slidePageInFromRight`, `EASE_OUT`, `EASE_IN`, `DURATION` |
| **Utils.js** | `getRandomSelectionRect()` — random rectangle placement within bounds. | `getRandomSelectionRect()` |

### Creature Animators (ES Modules)

| File | Purpose | Key Exports |
|---|---|---|
| **LizardAnimator.js** | Loads ant / beetle / lizard frame sequences (`assets/ANIMATION-SPRITES/ant/`, `assets/ANIMATION-SPRITES/beetle/`, `assets/ANIMATION-SPRITES/lizard/`) and spawns one near a newly enclosed group. Uses masked (under) and unmasked (over) layers so creatures vanish at card edges. | `initLizardAnimator()`, `setSpawnPoint()`, `spawnLizard()` |
| **LadybugAnimator.js** | Loads idle / walk / idle-to-active ladybug frames (`assets/ANIMATION-SPRITES/ladybug/...`) and spawns a ladybug that crawls along a project card. | `initLadybugAnimator()`, `spawnLadybug()` |
| **FrogAnimator.js** | Burst-crawl frog animation (`assets/ANIMATION-SPRITES/Frog/Frogcycle_*.png`): hop → freeze → turn → hop → exit. | `initFrogAnimator()`, `spawnFrog()` |
| **CaterpillarAnimator.js** | Canvas-overlay segmented caterpillar (`assets/ANIMATION-SPRITES/caterpillar/`) used inside the ArchivePanel. | `initCaterpillar()`, `spawnCaterpillar()` |
| **MobileCreatures.js** | Standalone, NON-module script (loaded via plain `<script defer>`). Spawns ant/beetle/lizard creatures on the `.mobile-redirect` card when tapped. Self-contained; does not import Config. | (global `<script>`) |

### HTML Pages

| File | Purpose |
|---|---|
| **index.html** | Main entry point. Loads jszip/gsap/pixi + `shilim.css`, the standalone `MobileCreatures.js`, and a module block that imports App + Resources, pre-loads self-hosted fonts (Hind Madurai, Gelasio, IBM Plex Mono), then runs `initApp()` → `LoadTextures()`. Includes a `.mobile-redirect` overlay steering small screens to the index. |
| **projectindex.html** | Standalone searchable archive index (no PixiJS). Fetches `data/projects.json`; card grid with thumbnails, category color-coding, search, and filter chips. Uses `shilim.css`. Links to per-project pages. |
| **projectpage.html** | Generic project detail page (fallback/template). Reads `projectId` from URL params, falls back to `data/sampleprojectpage.json`. Two-column: left gallery, right details/tags. Per-artist copies live under `assets/PROJECT-PAGES/<Name>/projectpage.html`. |
| **admin.html** | Admin dashboard (Netlify backend). CRUD over the project index via `/.netlify/functions/projects`, with thumbnail upload + category selection. Uses `shilim.css`. Direct-access tool (not linked from the site). |
| **admin-local.html** | Identical admin UI configured for the local Express server (`localhost:3001`, `/api/projects`, `/api/upload-thumbnail`). |
| **admin-projectpage.html** | Admin for per-project page content (`data/projectpage.json`), with a CKEditor rich-text field. Edits gallery images, title, subtitle, description sections. |

### Backend

| File | Purpose |
|---|---|
| **server.js** | Express server on port 3001. Serves static files. REST: `GET/POST/DELETE /api/projects` (reads/writes `data/projects.json`). Thumbnail upload via multer to `assets/PREVIEW-ASSETS/thumbnail/`. |
| **netlify/functions/projects.js** | Netlify serverless function. Same GET/POST/DELETE for projects.json. No file-upload support. CORS headers included. |
| **netlify.toml** | Deployment config. Redirects `/api/projects` and `/api/projects/:splat` to the serverless function. Publish directory is root. |

### Data Files

| File | Purpose |
|---|---|
| **data/projects.json** | Main project database. Array of project objects: title, author, startdate, enddate, date, primarycategory, secondarycategory, link, shortdescription, artistdescription, details, thumbnail. |
| **data/projectpage.json** | Per-project page data: gallery images, descriptions, section content for `projectpage.html`. |
| **data/sampleprojectpage.json** | Template/fallback used by `projectpage.html` and per-artist pages when no entry is found. Keep — actively referenced. |

### Styling

| File | Purpose |
|---|---|
| **shilim.css** | Shared stylesheet for every HTML page (index, project index, project pages, admin pages). Defines self-hosted font faces, the 1550×1000 container aesthetic, the `.mobile-redirect` overlay, project-index/grid styles, and admin form styling. Replaces the previously inline-per-page CSS. |

### Assets

| Folder/File | Purpose |
|---|---|
| **assets/GAME-TEXTURES/illustration1/ – illustration6/** | Each holds a `textures.zip` of pre-sliced 20×20px PNG tiles (`tile_ROW_COL.png`) painted onto the grid. 1=ART, 2=COMMUNITY, 3=ECOLOGY, 4=RESEARCH, 5=HEALTH, 6=EDUCATION. (All six are now populated — HEALTH/EDUCATION are no longer empty.) |
| **assets/ANIMATION-SPRITES/ant/, beetle/, lizard/** | Frame sequences for the ground creatures (used by LizardAnimator + MobileCreatures). |
| **assets/ANIMATION-SPRITES/ladybug/** (idle, walk, idle-to-active) | Ladybug frame sequences (LadybugAnimator). |
| **assets/ANIMATION-SPRITES/Frog/** | Frog cycle frames (`Frogcycle_*.png`, FrogAnimator). |
| **assets/ANIMATION-SPRITES/caterpillar/** | Caterpillar segment art (CaterpillarAnimator). |
| **assets/UI-ELEMENTS/tutorial/** | GIF demos shown by Tutorial.js (pick-category, drag-paint, enclose, switch-category). |
| **assets/PROJECT-PAGES/<Name>/** | Per-artist `projectpage.html` + media (21 artist folders, plus `_template/`). These are the real destinations linked from the index. |
| **assets/UI-ELEMENTS/fonts/** | Self-hosted Hind Madurai, Gelasio, IBM Plex Mono faces. |
| **assets/PREVIEW-ASSETS/thumbnail/** | Project thumbnails (uploaded via the admin tools). |
| **assets/GAME-TEXTURES/interactive_bg.png, index_bg.png, bg_white.png** | Grid background, archive-index label background, surrounded-region fill. |
| **assets/UI-ELEMENTS/RESET.png, HELP.png, PLUS.png, white_circle_bg.png** | Active UI icons (restart, help/tutorial, add, circular button bg). |
| **assets/ANIMATION-SPRITES/LEAVES2.png, DRAGONFLY3.png, FROG1.png** | Decorative illustrations that fade in on surrounded-group detection. |
| **assets/*.mp4, *.m4v** | Audio clips played via keyboard shortcuts (1/2/3) in ImageSection. |

### Third-Party Libraries (vendored)

| File | Purpose |
|---|---|
| **pixi.min.js** | PixiJS v8 — WebGL 2D rendering engine. |
| **gsap.min.js** | GreenSock — animations/tweens. |
| **jszip.min.js** | JSZip — client-side ZIP extraction for texture packs. |
| *(pixi.min.js.map)* | Source map, now git-ignored. |

### Tooling / Docs

| File | Purpose |
|---|---|
| **gridsplit/** | Standalone HTML/Canvas tool that slices a source image into the grid of `tile_ROW_COL.png` tiles (the input to each `textures.zip`). |
| **HEXAGONAL_CATEGORIES_UPDATE.md** | Historical note on the 4-category (cardinal) → 6-category (hexagonal) migration, now complete. |
| **package.json** | Node config for the Express dev server (express, cors, multer). `npm start` → `node server.js`. |
| **.gitignore** | Ignores `node_modules/`, `.DS_Store`, and `*.min.js.map`. |

---

## How the Interactive Grid Works (Core Mechanic)

1. **Landing**: The Shillim Institute intro shows while 6 texture ZIPs (~4MB each) download. Fonts pre-load so PixiJS text rasterises correctly. A "CONTINUE" button appears when ready. The Tutorial overlay then guides first interactions.

2. **Grid Painting**: The right panel is a grid of 20px cells. Dragging creates a rectangular selection; the **angle of the drag** (360° split into 6 sectors of 60°) chooses which category's illustration tiles fill it.

3. **Surrounded Detection**: After each drag, `TextureStats.updateSurroundedEmptyCells()` flood-fills to find empty cell groups fully enclosed by filled cells. A newly enclosed group adds a matching project card to the sidebar and spawns a creature near it.

4. **Category Bar**: The bottom bar reflects the proportion of each category's cells.

5. **Project Discovery**: Projects are matched by comparing grid category percentages against each project's `primarycategory` / `secondarycategory`, preferring matches on both.

---

## Open Issues / Notes

### Still open
1. **`projectDescriptionTexts` in Config.js are placeholders** — still literally `'Description 1'`–`'Description 6'`. These show in the bottom text box for category descriptions and should be replaced with real copy.
2. **No authentication on admin pages** — `admin*.html` have no login; anyone with the URL can edit/delete.
3. **Netlify function can't handle thumbnail uploads** — the serverless function does JSON CRUD only; the Express `/api/upload-thumbnail` (multer) has no serverless equivalent, so uploads via the Netlify admin will fail in production.
4. **gridsplit lacks ZIP packaging** — it emits individual tiles; zipping them into `textures.zip` is a manual, undocumented step.
5. **Desktop-first** — the PixiJS experience is fixed-size; small screens get the `.mobile-redirect` overlay to `projectindex.html` rather than a responsive grid.
6. **Audio uses `.mp4`/`.m4v`** for short clips — works but unconventional; `.mp3`/`.ogg` would be clearer.

### Resolved since the previous map
- **illustration5/6 now populated** — HEALTH and EDUCATION texture packs exist; painting works for all 6 categories.
- **`addRandomProject()` call fixed** — ImageSection now passes the correct 6 hexagonal percentage props (`topPercentage`, `topRightPercentage`, `bottomRightPercentage`, `bottomPercentage`, `bottomLeftPercentage`, `topLeftPercentage`).
- **Shared CSS** — styling consolidated into `shilim.css` instead of per-page inline blocks.
- **Per-artist project pages** — real destinations now live under `assets/PROJECT-PAGES/<Name>/projectpage.html` (21 artists + `_template/`).

### Cleanup performed (2026-06-29)
- Removed stray draft `Untitled` (an early duplicate of LizardAnimator).
- Removed unreferenced images: `bg_blue/red/yellow.png`, `BASE Button.png`, `restart_bg.png`, `CLOSE.png`, `OPEN.png`, `lizard_spritesheet.png`, `lizard_spritesheet300.png`.
- Removed leftover folders: `assets/NewThumbnails/`, `assets/starting-page/`. (`assets/PROJECT-PAGES/testartist/` was kept — it backs the `data/sampleprojectpage.json` fallback gallery.)
- Added `.gitignore` and untracked `node_modules/` (2,647 files) and 59 `.DS_Store` files from version control (files remain on disk).
