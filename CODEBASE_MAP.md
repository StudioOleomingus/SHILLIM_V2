# Shillim Institute Archive — Codebase Map

## Overview

This is an interactive archive website for the **Shillim Institute**, an organization in the Western Ghats (India) that sponsors art residencies, conservation fellowships, mapping workshops, and community programs. The website is built with **PixiJS** (WebGL-based 2D rendering) and uses a novel interaction model: users draw rectangular selections on a grid, the direction of their drag determines which project category is selected, and when enclosed regions form on the grid, matching projects appear in a sidebar panel. It also has a standard searchable project index, individual project pages, and admin CRUD interfaces.

The site deploys to **Netlify** (with serverless functions) and also has a local Express dev server.

---

## Architecture Diagram

```
index.html (Landing Page / PixiJS App)
  |
  |-- Config.js .............. Global constants, PIXI app instance, grid config, project data loader
  |-- App.js ................. Initializes the PIXI renderer, attaches canvas to DOM
  |-- Resources.js ........... Loading screen, downloads 6 zip texture packs, loads UI textures
  |     |                      Shows "SHILLIM INSTITUTE" intro → loading bar → "CONTINUE" button
  |     |                      On continue: inits InfoSection, ImageSection, BottomLayout
  |     |
  |-- ImageSection.js ........ Core interactive grid — drag-to-paint mechanic
  |     |                      Determines category by drag direction (6 hexagonal directions)
  |     |                      Detects "surrounded" empty cell groups → triggers project reveals
  |     |
  |-- InfoSection.js ......... Left sidebar — "ARCHIVE INDEX" button + scrollable project card list
  |     |                      Receives project additions from ImageSection via window.addRandomProject()
  |     |
  |-- ProjectCard.js ......... Creates individual card components (title, author, date)
  |     |                      Opens a detail window with artist/project description + link
  |     |
  |-- BottomLayout.js ........ Category proportion bar at bottom + text description box
  |     |                      6 colored sections resize to reflect grid fill percentages
  |     |
  |-- Utils.js ............... Helper: getRandomSelectionRect() — places selections randomly
  |
projectindex.html ............ Standalone searchable/filterable index page
  |                            Fetches data/projects.json, renders cards with thumbnails
  |                            Filter by category (ART/COMMUNITY/ECOLOGY/RESEARCH/HEALTH/EDUCATION)
  |                            Search by title, author, description
  |                            Links to project pages
  |
projectpage.html ............. Individual project detail page
  |                            Loads from data/projectpage.json (currently only sample data)
  |                            Left panel: image gallery with navigation
  |                            Right panel: title, dates, description, category tags
  |
admin.html ................... Admin panel (Netlify serverless backend)
  |                            CRUD for projects in data/projects.json
  |                            Calls /.netlify/functions/projects API
  |                            Thumbnail upload, category selection (primary + secondary)
  |
admin-local.html ............. Admin panel (local Express backend)
  |                            Same UI as admin.html but calls localhost:3001/api/projects
  |                            Supports thumbnail upload via /api/upload-thumbnail
  |
admin-projectpage.html ....... Admin panel for per-project page content
  |                            Manages data/projectpage.json
  |                            Edits gallery images, project details, description sections
  |
server.js .................... Local Express dev server (port 3001)
  |                            GET/POST/DELETE /api/projects
  |                            POST /api/upload-thumbnail (multer)
  |                            Serves static files
  |
netlify/functions/projects.js  Netlify serverless equivalent of server.js
  |                            GET/POST/DELETE for data/projects.json
  |                            No thumbnail upload support (limitation)
  |
netlify.toml ................. Netlify deploy config — redirects /api/projects → function
```

---

## File-by-File Breakdown

### Core JavaScript Modules (ES Modules)

| File | Purpose | Key Exports |
|---|---|---|
| **Config.js** | Central configuration. Creates the PIXI.Application (1550x1000). Defines grid params (50 rows x 62 cols, 20px cells), 6 categories (ART, COMMUNITY, ECOLOGY, RESEARCH, HEALTH, EDUCATION), drag direction enums, color palettes, folder paths for textures. Loads `data/projects.json` on init. | `app`, `TextureArray`, `GridCell`, `gridCells`, `projects`, `DragDirection`, `PLAIN_COLORS`, `interactiveRect`, `projectType`, etc. |
| **App.js** | Initializes the PIXI renderer with antialiasing, appends the canvas to `#app-container`, handles window resize. | `initApp()` |
| **Resources.js** | The loading/intro sequence. Shows institute title, subtitle, and a long description paragraph. Downloads 6 ZIP files (one per category) containing pre-sliced tile PNGs (`tile_ROW_COL.png`) using JSZip. Each ZIP is extracted into `TextureArray[categoryIndex][row][col]`. Also loads 8 UI textures (background, restart button, decorative leaves/dragonfly/frog, etc.). Shows a loading progress bar, then a "CONTINUE" button. On click, initializes the three main sections. | `LoadTextures()`, texture variables |
| **ImageSection.js** | The core interactive canvas (right side, 1240x1000px). Users drag rectangles on a 50x62 grid. Drag direction (360° mapped to 6 hexagonal sectors) determines which category texture is painted. Features: TextureStats class tracks fill percentages and detects "surrounded" empty cell groups using flood fill. When a new surrounded region forms, a random matching project card is added to InfoSection. Includes restart button, decorative fauna animations, keyboard-triggered audio (keys 1/2/3), rounded-corner sprite masking. | `initImageSection()` |
| **InfoSection.js** | Left sidebar panel (300px wide). Displays an "ARCHIVE INDEX" label that links to `projectindex.html`. Contains a scrollable container of project cards. `addRandomProject()` selects a project matching the current category percentages (primary + secondary category filtering). Supports wheel and drag scrolling with GSAP momentum. | `initInfoSection()`, `archiveIndexValueLabelText` |
| **BottomLayout.js** | Bottom bar showing 6 colored sections proportional to each category's grid fill percentage. Each section is labeled (ART, COMMUNITY, etc.) with rounded ends. Also renders a text box that shows random project descriptions when surrounded groups are found. | `initBottomLayout()`, `updateSectionSizes()`, `updateTextBox()` |
| **ProjectCard.js** | Factory function for creating PIXI-rendered project cards. Each card shows title, author, date, and a detail-expand button. Clicking opens a detail window with scrollable artist/project description and a URL button linking to the project page. Manages single-open-at-a-time behavior. | `createProjectCard()` |
| **Utils.js** | Single utility: `getRandomSelectionRect()` generates a random position for a rectangle within bounds. Used by ImageSection to place grid selections at random positions. | `getRandomSelectionRect()` |

### HTML Pages

| File | Purpose |
|---|---|
| **index.html** | Main entry point. Loads pixi.min.js, gsap.min.js, jszip.min.js. Imports Config → App → Resources as ES modules. Fixed 1550x1000 canvas with rounded corners and box shadow. |
| **projectindex.html** | Standalone searchable archive index. Pure HTML/CSS/JS (no PixiJS). Fetches `data/projects.json`. Grid of cards with thumbnails, category color-coding, search bar, category filter chips. Styled to match the 1550x1000 container aesthetic. Links to individual project pages. |
| **projectpage.html** | Individual project detail page. Reads `projectId` from URL params, fetches `data/projectpage.json`. Two-column layout: left image gallery with prev/next navigation, right panel with title, dates, description, and category tags. |
| **admin.html** | Admin dashboard for managing the project index (Netlify backend). Table view of all projects with edit/delete. Form for adding/editing projects with fields: title, author, dates, categories, descriptions, link, thumbnail upload. Calls `/.netlify/functions/projects`. |
| **admin-local.html** | Identical admin UI but configured for local Express server at `localhost:3001`. Uses `/api/projects` and `/api/upload-thumbnail` endpoints. |
| **admin-projectpage.html** | Admin for individual project page content. Manages `data/projectpage.json`. Form to edit gallery images (up to 5), title, subtitle, description sections. Separate from the main project index admin. |

### Backend

| File | Purpose |
|---|---|
| **server.js** | Express server on port 3001. Serves static files from root. REST API: `GET/POST/DELETE /api/projects` (reads/writes `data/projects.json`). Thumbnail upload via multer to `assets/thumbnail/`. |
| **netlify/functions/projects.js** | Netlify serverless function. Same GET/POST/DELETE for projects.json. No file upload support. CORS headers included. |
| **netlify.toml** | Deployment config. Redirects `/api/projects` and `/api/projects/:splat` to the serverless function. Publish directory is root. |

### Data Files

| File | Purpose |
|---|---|
| **data/projects.json** | Main project database. Array of project objects with: title, author, startdate, enddate, date (display string), primarycategory, secondarycategory, link, shortdescription, artistdescription, details, thumbnail path. Currently contains ~16 projects. |
| **data/projectpage.json** | Per-project page data. Contains gallery images, detailed descriptions, and section content for projectpage.html. Structure: `{ projects: [{ id, title, subtitle, images: [], sections: [] }] }` |
| **data/sampleprojectpage.json** | Example/template data for how a project page entry should look. |

### Assets

| Folder/File | Purpose |
|---|---|
| **assets/illustration1/ through illustration6/** | Each contains a `textures.zip` file. Each ZIP holds pre-sliced 20x20px PNG tiles named `tile_ROW_COL.png` (50 rows x 62 cols = 3,100 tiles per category). These are the images painted onto the interactive grid. illustration1=ART, 2=COMMUNITY, 3=ECOLOGY, 4=RESEARCH, 5=HEALTH, 6=EDUCATION. |
| **assets/interactive_bg.png** | Background image for the interactive grid area |
| **assets/restart_bg.png** | Restart/clear button icon |
| **assets/bg_white.png** | White background fill texture (used for surrounded region coloring) |
| **assets/index_bg.png** | Background for the "ARCHIVE INDEX" label |
| **assets/white_circle_bg.png** | Circular button background texture |
| **assets/LEAVES2.png, DRAGONFLY3.png, FROG1.png** | Decorative nature illustrations that fade in when surrounded groups are detected |
| **assets/*.mp4, *.m4v** | Audio clips playable via keyboard shortcuts (1, 2, 3) |
| **assets/thumbnail/** | Uploaded project thumbnail images |
| **assets/button.png** | UI button asset |
| **assets/bg_blue.png, bg_red.png, bg_yellow.png** | Colored background textures (currently unused in main app) |

### Third-Party Libraries (vendored)

| File | Purpose |
|---|---|
| **pixi.min.js** | PixiJS v8 — WebGL 2D rendering engine |
| **gsap.min.js** | GreenSock Animation Platform — smooth animations and tweens |
| **jszip.min.js** | JSZip — client-side ZIP extraction for texture packs |

### Utility

| File | Purpose |
|---|---|
| **gridsplit/** | Standalone HTML tool for splitting a source image into the 50x62 grid of 20x20px tiles. Uses HTML5 Canvas. Outputs individual PNG tiles with naming `tile_ROW_COL.png`. This is the production tool for generating the texture ZIP content. |
| **HEXAGONAL_CATEGORIES_UPDATE.md** | Documentation describing the migration from 4-category (cardinal directions) to 6-category (hexagonal directions) system. |
| **package.json** | Node.js project config for the Express dev server. Dependencies: express, cors, multer. |
| **.gitignore** | Ignores node_modules. |

---

## How the Interactive Grid Works (Core Mechanic)

1. **Landing**: User sees the Shillim Institute introduction text. Textures load in background (6 ZIP files, ~4MB each). A "CONTINUE" button appears when ready.

2. **Grid Painting**: The right panel (1240x1000px) is a 62x50 grid of 20px cells. The user drags to create a rectangular selection. The **angle of the drag** (360° divided into 6 sectors of 60° each) determines which category's illustration tiles fill the selection. The visual result is patches of different illustrated textures building up on the canvas.

3. **Surrounded Detection**: After each drag, `TextureStats.updateSurroundedEmptyCells()` runs a flood-fill algorithm to find groups of empty cells completely surrounded by filled cells (8-connected adjacency). When a new surrounded group appears, a **project card** matching the current category proportions is added to the left sidebar.

4. **Category Bar**: The bottom bar dynamically reflects the proportion of each category's cells on the grid.

5. **Project Discovery**: Projects are matched by comparing the grid's category percentages against each project's `primarycategory` and `secondarycategory`. The system tries to find projects that match both the dominant and secondary category, falling back to either one.

---

## Missing Parts and Issues

### Critical Missing Pieces

1. **illustration5/ and illustration6/ folders are EMPTY** — These correspond to HEALTH and EDUCATION categories. The folders exist but contain no `textures.zip` files. Dragging in the BottomLeft (HEALTH) or TopLeft (EDUCATION) directions will fail silently or show nothing. The grid painting mechanic is broken for 2 out of 6 categories.

2. **projectpage.html links are mostly placeholder** — Most projects in `projects.json` have `"link": "projectpage.html"` without a `projectId` query parameter. Only the first project (Elvira) has a unique project page path (`assets/artists/Elvira/projectpage.html`). The `projectpage.html` file reads `projectId` from URL params, but no projects provide one, so most project links will show a "Project not found" state.

3. **projectpage.json is minimal** — The `data/projectpage.json` contains very little data. Most projects don't have corresponding entries. The project page gallery and sections system exists in the HTML but has almost no content to display.

4. **projectDescriptionTexts in Config.js are placeholder** — The 6 description strings are literally `'Description 1'` through `'Description 6'`. These show in the bottom text box when surrounded groups are found. They should contain real category descriptions.

### Functional Issues

5. **addRandomProject() called with wrong property names** — In ImageSection.js line ~1037, the function is called with `textureStats.topToBottomRightPercentage` and similar properties, but `TextureStats` only defines `topPercentage`, `topRightPercentage`, `bottomRightPercentage`, etc. These old 4-direction property names don't exist, so `undefined` values are passed. Projects still get added but category matching is likely broken.

6. **No authentication on admin pages** — The admin.html and admin-local.html pages have no login or authentication. Anyone with the URL can add, edit, or delete projects.

7. **Netlify function can't handle thumbnail uploads** — The Netlify serverless function (`netlify/functions/projects.js`) only handles JSON CRUD. There's no equivalent of the Express multer endpoint for file uploads. The admin.html (Netlify version) references file upload but it will fail in production.

8. **gridsplit tool lacks ZIP packaging** — The `gridsplit/index.html` tool outputs individual PNG tiles but doesn't create the `textures.zip` files that Resources.js expects. There's a manual step to ZIP the tiles that isn't documented.

### Polish/Minor Issues

9. **Title tag says "PixiJS Game"** — The `index.html` title should be "Shillim Institute" or similar.

10. **Audio files have inconsistent formats** — `.mp4` and `.m4v` files are used for audio, which is unusual. These should ideally be `.mp3` or `.ogg` for broader compatibility and to make intent clear.

11. **No mobile/responsive support for the PixiJS app** — The main canvas is fixed at 1550x1000 with `max-width: 95vw`. On mobile devices, the drag interaction would be very difficult. The `projectindex.html` and `projectpage.html` have somewhat responsive layouts but the core experience is desktop-only.

12. **No 404 or error handling for missing texture ZIPs** — If a texture ZIP fails to download, the error is caught but the UI doesn't gracefully degrade.

13. **Unused assets** — `bg_blue.png`, `bg_red.png`, `bg_yellow.png`, `button.png` appear to be unused by any current code.

14. **No CSS file** — All styling is inline in each HTML file. A shared stylesheet would reduce duplication across the 5+ HTML pages.
