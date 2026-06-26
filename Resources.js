import { app, TextureArray, folderPaths, numberOfRows, numberOfColumns, cellSize, interactiveRect, stageHeight } from './Config.js';
import { initInfoSection } from './InfoSection.js';
import { initImageSection } from './ImageSection.js';
import { initBottomLayout } from './BottomLayout.js';
import { startTutorial } from './Tutorial.js';
import { slidePageInFromRight } from './Transitions.js';

let loadingContainer;
let continueText;
let interactiveBgTexture;
let restartButtonTexture;
let whitebgTexture;
let indexBg;
let whiteCircleBg;
let leavesTexture;
let dragonflyTexture;
let frogTexture;

// Gutter (in source pixels) left between tiles in the atlas so that linear
// filtering when the tiles are scaled down can't bleed in neighbouring pixels.
const ATLAS_PADDING = 2;

async function downloadAndExtractZip(zipUrl, index) {
    try {
        // Check if JSZip is available
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library is not loaded. Please check your script includes.');
        }

        // Download the zip file
        const response = await fetch(zipUrl);
        if (!response.ok) {
            throw new Error(`Failed to download zip file: ${response.status} ${response.statusText}`);
        }
        const zipData = await response.arrayBuffer();

        // Load zip data
        const zip = new JSZip();
        await zip.loadAsync(zipData);

        // Collect the real tile entries. macOS zips also contain resource-fork
        // junk (e.g. "__MACOSX/textures/._tile_0_0.png") whose name matches the
        // tile pattern but is not a valid PNG — skip those so we don't waste
        // time decoding ~3000 images that only ever fail.
        const tileEntries = [];
        for (const [filename, file] of Object.entries(zip.files)) {
            if (file.dir) continue;
            const baseName = filename.split('/').pop();
            if (filename.includes('__MACOSX') || baseName.startsWith('._')) continue;
            const match = baseName.match(/tile_(\d+)_(\d+)\.png$/);
            if (!match) continue;
            tileEntries.push({
                file,
                row: parseInt(match[1], 10),
                col: parseInt(match[2], 10)
            });
        }

        // Decode every tile PNG into an Image element.
        const decoded = await Promise.all(tileEntries.map(async (entry) => {
            const blob = await entry.file.async('blob');
            const objectUrl = URL.createObjectURL(blob);
            try {
                const img = await new Promise((resolve, reject) => {
                    const image = new Image();
                    image.onload = () => resolve(image);
                    image.onerror = () => reject(new Error(`Failed to load tile_${entry.row}_${entry.col}`));
                    image.src = objectUrl;
                });
                return { row: entry.row, col: entry.col, img };
            } catch (error) {
                // Skip individual tiles that fail to decode rather than aborting
                // the whole illustration.
                return null;
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        }));

        const tiles = decoded.filter(Boolean);
        if (tiles.length === 0) {
            console.warn(`No usable tiles found in ${zipUrl}`);
            return true;
        }

        // Determine tile size from the first decoded tile (all tiles are the
        // same size in practice).
        const tileW = tiles[0].img.naturalWidth || tiles[0].img.width;
        const tileH = tiles[0].img.naturalHeight || tiles[0].img.height;
        const cellW = tileW + ATLAS_PADDING;
        const cellH = tileH + ATLAS_PADDING;

        // Pack every tile of this illustration into ONE atlas canvas, so the GPU
        // only has to allocate a single texture per illustration (6 total)
        // instead of thousands. Chrome's WebGL backend loses the rendering
        // context when too many individual textures are uploaded, which left the
        // interactive page blank.
        const atlas = document.createElement('canvas');
        atlas.width = numberOfColumns * cellW;
        atlas.height = numberOfRows * cellH;
        const atlasCtx = atlas.getContext('2d');

        for (const tile of tiles) {
            atlasCtx.drawImage(tile.img, tile.col * cellW, tile.row * cellH, tileW, tileH);
        }

        // Upload the atlas as a single shared texture source, then give each grid
        // cell a lightweight sub-texture (a frame into the atlas). Downstream code
        // only ever reads `.texture` off the stored entry.
        const atlasSource = PIXI.Texture.from(atlas).source;
        atlasSource.update();

        for (const tile of tiles) {
            const frame = new PIXI.Rectangle(tile.col * cellW, tile.row * cellH, tileW, tileH);
            const tileTexture = new PIXI.Texture({ source: atlasSource, frame });
            TextureArray[index][tile.row][tile.col] = { texture: tileTexture };
        }

        return true;
    } catch (error) {
        console.error('Error downloading or extracting zip:', error);
        throw error;
    }
}

async function LoadTextures() {
    try {
        // ===================================================================
        // LANDING / INTRO SCREEN
        // White content box matches the game page's play-card geometry.
        // ===================================================================
        let isLoading = false;
        let texturesLoaded = false;

        const PLAY_GAP = 14;
        const boxX = interactiveRect.x + PLAY_GAP;                 // 324
        const boxY = PLAY_GAP;                                      // 14
        const boxW = interactiveRect.width - PLAY_GAP * 2;          // 1212
        // Lay the intro box out in the fixed 1550x1000 logical space; the canvas
        // is scaled to the window via CSS, so the design height keeps the box
        // matching the game-page play card at any window size.
        const boxH = stageHeight - PLAY_GAP * 2;

        const intro = new PIXI.Container();
        app.stage.addChild(intro);

        // White rounded inner box (same size/feel as the game page).
        const whiteBox = new PIXI.Graphics();
        whiteBox.beginFill(0xFFFFFF);
        whiteBox.drawRoundedRect(boxX, boxY, boxW, boxH, 28);
        whiteBox.endFill();
        intro.addChild(whiteBox);

        // Content anchors inside the white box (left-aligned with the title).
        const TEXT_LEFT = boxX + 22;
        const CONTENT_LEFT = TEXT_LEFT;
        const CONTENT_WRAP = 760;

        const WEBSITE_DESC = 'This website is an interactive repository of projects by the Shillim Institute. It encompasses work ranging from art residencies and mapping workshops to ecological surveys and reforestation programs, as well as educational initiatives and community outreach.\n\nThe archive invites visitors to draw new associations between these varied works, situating each project within the landscape of the Sahyadris from which they emerge.';

        // First institute is real; the remaining seven are placeholders.
        const institutes = [
            {
                name: 'The Shillim Institute',
                heading: 'Inspiring Commitment to Action through Sustainable art practices in the Sahyadri Western Ghats India',
                body: 'Located in the Western Ghats, The Shillim Institute safeguards approximately 2000 acres of land in the Northern region of this mountain range, which has been declared a UNESCO World Heritage Site and a biodiversity conservation hotspot. The Institute has enlisted local communities as forest guards and introduced thousands of native plant species, resulting in the flourishing of over a million trees comprising 64 diverse species.\n\nThe Pavna Collective is a consortium of conservation, ecology, and art organizations, convened by the Shillim Institute. Among its initiatives, the Pavna Collective sponsors 3-6 art residencies a year, fellowships, Mapping Workshop, Cultural documentation and Skill development programs in the Sayadri ranges.'
            },
            { name: 'Organisation 01', heading: 'Organisation 01', body: 'Placeholder description for Organisation 01. Replace this with a short overview of the organisation.' },
            { name: 'Organisation 02', heading: 'Organisation 02', body: 'Placeholder description for Organisation 02. Replace this with a short overview of the organisation.' },
            { name: 'Organisation 03', heading: 'Organisation 03', body: 'Placeholder description for Organisation 03. Replace this with a short overview of the organisation.' },
            { name: 'Organisation 04', heading: 'Organisation 04', body: 'Placeholder description for Organisation 04. Replace this with a short overview of the organisation.' },
            { name: 'Organisation 05', heading: 'Organisation 05', body: 'Placeholder description for Organisation 05. Replace this with a short overview of the organisation.' },
            { name: 'Organisation 06', heading: 'Organisation 06', body: 'Placeholder description for Organisation 06. Replace this with a short overview of the organisation.' },
            { name: 'Organisation 07', heading: 'Organisation 07', body: 'Placeholder description for Organisation 07. Replace this with a short overview of the organisation.' }
        ];

        // Big title — lighter weight, large enough to span the box width,
        // pushed up from the very bottom.
        const bigTitle = new PIXI.Text('THE SHILLIM ARCHIVE', {
            fontFamily: 'Hind Madurai', fontWeight: '520', fontSize: 120, fill: 0xa4a4a4
        });
        bigTitle.anchor.set(0, 1);
        bigTitle.x = TEXT_LEFT;
        bigTitle.y = boxY + boxH - 18;
        intro.addChild(bigTitle);

        // Full-width loading-bar / continue row, just above the title.
        const BAR_X = TEXT_LEFT;
        const BAR_W = boxW - (TEXT_LEFT - boxX) * 2;     // even left/right inset
        const BAR_Y = bigTitle.y - bigTitle.height - 30;

        // Heading line (shown only when an institute is selected).
        const headingText = new PIXI.Text('', {
            fontFamily: 'Hind Madurai', fontSize: 24, fill: 0x222222,
            wordWrap: true, wordWrapWidth: CONTENT_WRAP, lineHeight: 32
        });
        headingText.x = CONTENT_LEFT;
        headingText.visible = false;
        intro.addChild(headingText);

        // Body / description text (swaps between website and institute copy).
        const bodyText = new PIXI.Text(WEBSITE_DESC, {
            fontFamily: 'Hind Madurai', fontSize: 20, fill: 0x222222,
            align: 'justify',
            wordWrap: true, wordWrapWidth: CONTENT_WRAP, lineHeight: 25.5
        });
        bodyText.x = CONTENT_LEFT;
        intro.addChild(bodyText);

        // Top of the website description (measured at creation). Institute text
        // is shown at this exact same height.
        const DESC_TOP = BAR_Y - 28 - bodyText.height;

        function layoutContent() {
            if (selectedInstitute === -1) {
                // Default: website description sits low, just above the loading bar.
                bodyText.y = DESC_TOP;
            } else {
                // Institute: body shown at the same height as the website description.
                let cy = DESC_TOP;
                if (headingText.visible && headingText.text) {
                    headingText.y = cy;
                    cy += headingText.height + 24;
                }
                bodyText.y = cy;
            }
        }

        // ----- Continue button (right end of the loading-bar row) -----
        continueText = new PIXI.Text('CONTINUE', {
            fontFamily: 'Hind Madurai', fontSize: 22, fill: '#4A90E2'
        });
        continueText.anchor.set(1, 0.5);
        continueText.x = BAR_X + BAR_W - 56;
        continueText.y = BAR_Y - 18;
        continueText.eventMode = 'static';
        continueText.cursor = 'pointer';
        continueText.visible = false;
        intro.addChild(continueText);

        // ----- Loading bar (full width of the box, above the title) -----
        loadingContainer = new PIXI.Container();
        loadingContainer.visible = true;
        intro.addChild(loadingContainer);

        const loadingText = new PIXI.Text('LOADING ARCHIVE...', {
            fontFamily: 'Hind Madurai', fontSize: 20, fill: '#3092cf'
        });
        loadingText.anchor.set(0, 1);
        loadingText.x = BAR_X + BAR_W - 180;
        loadingText.y = BAR_Y - 18;
        loadingContainer.addChild(loadingText);

        const loadingBarBg = new PIXI.Graphics();
        loadingBarBg.beginFill(0xDDDDDD);
        loadingBarBg.drawRoundedRect(BAR_X, BAR_Y, BAR_W, 20, 10);
        loadingBarBg.endFill();
        loadingContainer.addChild(loadingBarBg);

        const loadingBarFill = new PIXI.Graphics();
        loadingBarFill.beginFill(0x4A90E2);
        loadingContainer.addChild(loadingBarFill);

        // ----- Institute name list (left column, light-grey capsule buttons) -----
        let selectedInstitute = -1;
        const nameItems = [];
        const NAME_X = 40;
        const NAME_GAP = 70;            // tighter spacing
        const NAME_PAD_X = 27;          // capsule grown by ~10px each dimension
        const NAME_PAD_Y = 16;

        // Vertically centre the whole stack of buttons in the box.
        const sampleLabel = new PIXI.Text('A', { fontFamily: 'Hind Madurai', fontWeight: '200', fontSize: 20 });
        const NAME_CAP_H = sampleLabel.height + NAME_PAD_Y * 2;
        sampleLabel.destroy();
        const NAME_GROUP_H = (institutes.length - 1) * NAME_GAP + NAME_CAP_H;
        const NAME_Y0 = Math.round(app.screen.height / 2 - NAME_GROUP_H / 2);

        // Uniform button width — sized to the widest name so all capsules match.
        let NAME_MAX_W = 0;
        institutes.forEach((inst) => {
            const t = new PIXI.Text(inst.name.toUpperCase(), { fontFamily: 'Hind Madurai', fontWeight: '200', fontSize: 20 });
            NAME_MAX_W = Math.max(NAME_MAX_W, t.width);
            t.destroy();
        });
        const NAME_CAP_W = Math.ceil(NAME_MAX_W) + NAME_PAD_X * 2;

        function applyNameStyles() {
            nameItems.forEach(({ label, bg }, i) => {
                const active = (selectedInstitute === -1 || i === selectedInstitute);
                label.style.fill = active ? 0x111111 : 0xb8b8b8;
                // selected capsule reads slightly darker; others sit at base grey
                bg.tint = (i === selectedInstitute) ? 0xdcdcdc : 0xffffff;
            });
        }

        function showDefault() {
            selectedInstitute = -1;
            bigTitle.visible = true;
            headingText.visible = false;
            headingText.text = '';
            bodyText.text = WEBSITE_DESC;
            continueText.visible = texturesLoaded;
            loadingContainer.visible = !texturesLoaded;
            applyNameStyles();
            layoutContent();
        }

        function selectInstitute(i) {
            selectedInstitute = i;
            const inst = institutes[i];
            bigTitle.visible = false;
            headingText.visible = true;
            headingText.text = inst.heading;
            bodyText.text = inst.body;
            continueText.visible = false;
            loadingContainer.visible = false;
            applyNameStyles();
            layoutContent();
        }

        institutes.forEach((inst, i) => {
            const item = new PIXI.Container();
            item.x = NAME_X;
            item.y = NAME_Y0 + i * NAME_GAP;

            const label = new PIXI.Text(inst.name.toUpperCase(), {
                fontFamily: 'Hind Madurai', fontWeight: '200', fontSize: 20, fill: 0x111111
            });
            label.x = NAME_PAD_X;
            label.y = NAME_PAD_Y;

            const capW = NAME_CAP_W;            // uniform width for every button
            const capH = label.height + NAME_PAD_Y * 2;

            const bg = new PIXI.Graphics();
            bg.beginFill(0xf0f0f0);
            bg.drawRoundedRect(0, 0, capW, capH, 12);
            bg.endFill();

            item.addChild(bg);
            item.addChild(label);
            item.eventMode = 'static';
            item.cursor = 'pointer';
            item.hitArea = new PIXI.Rectangle(0, 0, capW, capH);

            // Hover: darken the capsule unless it's the selected one.
            item.on('pointerover', () => { if (selectedInstitute !== i) bg.tint = 0xe2e2e2; });
            item.on('pointerout', () => { applyNameStyles(); });
            item.on('pointertap', (e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                selectInstitute(i);
            });

            intro.addChild(item);
            nameItems.push({ item, label, bg });
        });

        // Click anywhere outside a name returns to the default title view.
        app.stage.eventMode = 'static';
        app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height);
        app.stage.on('pointertap', () => {
            if (selectedInstitute !== -1) showDefault();
        });

        // Set the initial (default) state.
        showDefault();

        // Start loading textures immediately in the background
        const textureLoadingPromise = (async () => {
            let index = 0;
            const totalFolders = folderPaths.length;

            for (const folderPath of folderPaths) {
                const zipUrl = `${folderPath}/textures.zip`;
                await downloadAndExtractZip(zipUrl, index);
                
                // Update loading bar
                const progress = (index + 1) / totalFolders;
                loadingBarFill.clear();
                loadingBarFill.beginFill(0x4A90E2);
                loadingBarFill.drawRoundedRect(BAR_X, BAR_Y, BAR_W * progress, 20, 10);
                loadingBarFill.endFill();
                
                index++;
            }

            // Load the background textures with retry logic
            const maxRetries = 3;
            const retryDelay = 1000; // 1 second delay between retries

            async function loadTextureWithRetry(path, retries = 0) {
                try {
                    return await PIXI.Assets.load(path);
                } catch (error) {
                    if (retries < maxRetries) {
                        console.log(`Retry ${retries + 1} for ${path}`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        return loadTextureWithRetry(path, retries + 1);
                    }
                    throw new Error(`Failed to load texture ${path} after ${maxRetries} retries`);
                }
            }

            try {
                // Load all textures with retry logic
                [interactiveBgTexture, restartButtonTexture, whitebgTexture, indexBg, whiteCircleBg, leavesTexture, dragonflyTexture, frogTexture] = await Promise.all([
                    loadTextureWithRetry('assets/interactive_bg.png'),
                    loadTextureWithRetry('assets/RESET.png'),
                    loadTextureWithRetry('assets/bg_white.png'),
                    loadTextureWithRetry('assets/index_bg.png'),
                    loadTextureWithRetry('assets/white_circle_bg.png'),
                    loadTextureWithRetry('assets/LEAVES2.png'),
                    loadTextureWithRetry('assets/DRAGONFLY3.png'),
                    loadTextureWithRetry('assets/FROG1.png'),
                    loadTextureWithRetry('assets/PLUS.png'),
                    loadTextureWithRetry('assets/HELP.png'),
                ]);

                texturesLoaded = true;
                // Reveal the continue button only if we're on the default view.
                if (selectedInstitute === -1) {
                    continueText.visible = true;
                    loadingContainer.visible = false;
                }
            } catch (error) {
                console.error('Failed to load background textures:', error);
                // Surface the error in the body text.
                bodyText.text = 'Error loading textures. Please refresh the page.';
                bodyText.style.fill = 0xFF0000; // Red color for error
            }
        })();

        // Handle continue button click
        continueText.on('pointertap', async (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (isLoading) return;

            // Hide the landing content.
            bigTitle.visible = false;
            headingText.visible = false;
            bodyText.visible = false;
            continueText.visible = false;

            // Show loading container while waiting for textures
            if (!texturesLoaded) {
                isLoading = true;
                loadingContainer.visible = true;
                try {
                    await textureLoadingPromise;
                } catch (error) {
                    console.error('Error loading textures:', error);
                    loadingContainer.visible = false;
                    return;
                }
            }

            loadingContainer.visible = false;
            isLoading = false;

            // Remove the whole landing screen before the game cascades in.
            intro.visible = false;

            // Push the whole stage off to the right BEFORE building the
            // interactive sections, so they're created off-screen and can
            // cascade in cleanly (same motion as the Archive Index panel).
            app.stage.x = app.screen.width;

            // Initialize sections
            await initInfoSection();
            await initImageSection();
            await initBottomLayout();

            // Cascade the interactive page in from the right, then start the tutorial.
            slidePageInFromRight(app.stage, app.screen.width, {
                duration: 0.75,
                onComplete: () => startTutorial()
            });
        });

        return {
            success: true,
            message: 'Ready to start'
        };

    } catch (error) {
        console.error('Error in LoadTextures:', error);
        throw error;
    }
}

export { LoadTextures, interactiveBgTexture, restartButtonTexture, whitebgTexture, indexBg, whiteCircleBg, leavesTexture, dragonflyTexture, frogTexture };