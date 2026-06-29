import { app, TextureArray, folderPaths, numberOfRows, numberOfColumns, cellSize, interactiveRect, stageHeight } from './Config.js';
import { initInfoSection } from './InfoSection.js';
import { initImageSection } from './ImageSection.js';
import { initBottomLayout } from './BottomLayout.js';
import { startTutorial } from './Tutorial.js';
import { slidePageInFromRight } from './Transitions.js';

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
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library is not loaded. Please check your script includes.');
        }

        const response = await fetch(zipUrl);
        if (!response.ok) {
            throw new Error(`Failed to download zip file: ${response.status} ${response.statusText}`);
        }
        const zipData = await response.arrayBuffer();

        const zip = new JSZip();
        await zip.loadAsync(zipData);

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

        const tileW = tiles[0].img.naturalWidth || tiles[0].img.width;
        const tileH = tiles[0].img.naturalHeight || tiles[0].img.height;
        const cellW = tileW + ATLAS_PADDING;
        const cellH = tileH + ATLAS_PADDING;

        const atlas = document.createElement('canvas');
        atlas.width = numberOfColumns * cellW;
        atlas.height = numberOfRows * cellH;
        const atlasCtx = atlas.getContext('2d');

        for (const tile of tiles) {
            atlasCtx.drawImage(tile.img, tile.col * cellW, tile.row * cellH, tileW, tileH);
        }

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
        let isLoading = false;
        let texturesLoaded = false;

        // ──────────────────────────────────────────────────────────────
        // Copy / content
        // ──────────────────────────────────────────────────────────────
        const ARCHIVE_DESC =
            'This website is an interactive repository of projects by the Shillim Institute and other associated organisations. It encompasses work ranging from art residencies and mapping workshops to ecological surveys and reforestation programs, as well as educational and craft initiatives, and other such community outreach.\n\nThe archive invites visitors to draw new associations between these varied works, situating each project within the landscape of the Sahyadris from which they emerge';

        const ABOUT_HEADING = 'The Shillim Institute.';
        const ABOUT_SUBTITLE = 'Inspiring Commitment to Action through Sustainable art practices\nin the Sahyadri Western Ghats India.';
        const ABOUT_BODY =
            'Located in the Western Ghats, The Shillim Institute safeguards approximately 2000 acres of land in the Northern region of this mountain range, which has been declared a UNESCO World Heritage Site and a biodiversity conservation hotspot. The Institute has enlisted local communities as forest guards and introduced thousands of native plant species, resulting in the flourishing of over a million trees comprising 64 diverse species.\n\nThe Pavna Collective is a consortium of conservation, ecology, and art organizations, convened by the Shillim Institute. Among its initiatives, the Pavna Collective sponsors 3-6 art residencies a year, fellowships, Mapping Workshop, Cultural documentation and Skill development programs in the Sayadri ranges.';

        // ──────────────────────────────────────────────────────────────
        // Geometry
        // ──────────────────────────────────────────────────────────────
        const GREEN = 0x86bf9b;
        const INK = 0x1f1f1f;
        const BOX_FILL = 0xe8e8e8;
        const BTN_DARK = 0xcfcfcf;
        const BTN_LIGHT = 0xe2e2e2;
        const WHITE_CARD = 0xffffff;

        const PLAY_GAP = 14;
        const cardX = interactiveRect.x + PLAY_GAP;
        const cardY = PLAY_GAP;
        const cardW = interactiveRect.width - PLAY_GAP * 2;
        const cardH = stageHeight - PLAY_GAP * 2;
        const cardCX = cardX + cardW / 2;
        const cardCY = cardY + cardH / 2;

        const BOX_W = 920;
        const BOX_X = Math.round(cardCX - BOX_W / 2);
        const PAD = 40;
        const WRAP = BOX_W - PAD * 2;

        const BTN_H = 58;
        const BTN_GAP = 18;          // gap between box and button row
        const BTN_RADIUS = 14;
        const BTN_PAD_X = 30;

        // ──────────────────────────────────────────────────────────────
        // Containers
        // ──────────────────────────────────────────────────────────────
        const intro = new PIXI.Container();
        app.stage.addChild(intro);

        // Big white card
        const whiteBox = new PIXI.Graphics();
        whiteBox.beginFill(WHITE_CARD);
        whiteBox.drawRoundedRect(cardX, cardY, cardW, cardH, 28);
        whiteBox.endFill();
        whiteBox.eventMode = 'static';
        whiteBox.hitArea = new PIXI.Rectangle(cardX, cardY, cardW, cardH);
        intro.addChild(whiteBox);

        // The grey description box (redrawn per view). It captures its own
        // clicks so that tapping inside the box never triggers the
        // click-outside-to-return behaviour.
        const box = new PIXI.Graphics();
        box.eventMode = 'static';
        box.on('pointertap', (e) => { if (e && e.stopPropagation) e.stopPropagation(); });
        intro.addChild(box);

        // ---- Archive (default) content ----
        const archiveContent = new PIXI.Container();
        intro.addChild(archiveContent);

        const descText = new PIXI.Text(ARCHIVE_DESC, {
            fontFamily: 'Hind Madurai', fontWeight: '63', fontSize: 21, fill: INK,
            align: 'justify', wordWrap: true, wordWrapWidth: WRAP, lineHeight: 30
        });
        archiveContent.addChild(descText);

        const bigTitle = new PIXI.Text('THE SHILLIM ARCHIVE', {
            fontFamily: 'Hind Madurai', fontWeight: '630', fontSize: 82, fill: GREEN, letterSpacing: 1
        });
        if (bigTitle.width > WRAP) bigTitle.scale.set(WRAP / bigTitle.width);
        archiveContent.addChild(bigTitle);

        // ---- About content ----
        const aboutContent = new PIXI.Container();
        aboutContent.visible = false;
        intro.addChild(aboutContent);

        const aboutHeading = new PIXI.Text(ABOUT_HEADING, {
            fontFamily: 'Gelasio', fontWeight: '700', fontSize: 42,  fill: GREEN
        });
        aboutContent.addChild(aboutHeading);

        const aboutSubtitle = new PIXI.Text(ABOUT_SUBTITLE, {
            fontFamily: 'Hind Madurai', fontWeight: '100', fontSize: 21, fill: 0x1a1a1a,
            lineHeight: 28, wordWrap: true, wordWrapWidth: WRAP
        });
        aboutContent.addChild(aboutSubtitle);

        const aboutBody = new PIXI.Text(ABOUT_BODY, {
            fontFamily: 'Hind Madurai', fontSize: 20, fill: 0x1f1f1f,
            align: 'justify', wordWrap: true, wordWrapWidth: WRAP, lineHeight: 27
        });
        aboutContent.addChild(aboutBody);

        // ──────────────────────────────────────────────────────────────
        // Buttons
        // ──────────────────────────────────────────────────────────────
        // Generic pill button factory. Returns { container, setWidth, label, bg }.
        function makeButton({ text, fill, align = 'left', icon = null }) {
            const c = new PIXI.Container();
            c.eventMode = 'static';
            c.cursor = 'pointer';

            const bg = new PIXI.Graphics();
            c.addChild(bg);

            const label = new PIXI.Text(text, {
                fontFamily: 'Hind Madurai', fontWeight: '200', fontSize: 19, fill: 0x222222, letterSpacing: 1
            });
            label.anchor.set(0, 0.5);
            label.y = BTN_H / 2;
            c.addChild(label);

            let iconGfx = null;
            if (icon) {
                iconGfx = new PIXI.Graphics();
                c.addChild(iconGfx);
            }

            let curW = 0;
            function draw(w) {
                curW = w;
                bg.clear();
                bg.beginFill(fill);
                bg.drawRoundedRect(0, 0, w, BTN_H, BTN_RADIUS);
                bg.endFill();
                c.hitArea = new PIXI.Rectangle(0, 0, w, BTN_H);

                if (icon === 'arrow') {
                    // right-aligned text + triangle
                    const aSize = 12;
                    const aX = w - BTN_PAD_X - aSize;
                    const aCY = BTN_H / 2;
                    iconGfx.clear();
                    iconGfx.beginFill(0x222222);
                    iconGfx.moveTo(aX, aCY - aSize / 2);
                    iconGfx.lineTo(aX + aSize, aCY);
                    iconGfx.lineTo(aX, aCY + aSize / 2);
                    iconGfx.closePath();
                    iconGfx.endFill();
                    label.anchor.set(1, 0.5);
                    label.x = aX - 16;
                } else if (icon === 'back') {
                    // left-pointing triangle then text
                    const aSize = 12;
                    const aX = BTN_PAD_X;
                    const aCY = BTN_H / 2;
                    iconGfx.clear();
                    iconGfx.beginFill(0x222222);
                    iconGfx.moveTo(aX + aSize, aCY - aSize / 2);
                    iconGfx.lineTo(aX, aCY);
                    iconGfx.lineTo(aX + aSize, aCY + aSize / 2);
                    iconGfx.closePath();
                    iconGfx.endFill();
                    label.anchor.set(0, 0.5);
                    label.x = aX + aSize + 16;
                } else {
                    label.anchor.set(align === 'right' ? 1 : 0, 0.5);
                    label.x = align === 'right' ? w - BTN_PAD_X : BTN_PAD_X;
                }
            }

            // intrinsic width for auto-sized buttons (icon adds room)
            function intrinsicWidth() {
                let w = label.width + BTN_PAD_X * 2;
                if (icon === 'back') w = label.width + BTN_PAD_X * 2 + 12 + 16;
                return Math.ceil(w);
            }

            c.on('pointerover', () => { bg.tint = 0xf0f0f0; });
            c.on('pointerout', () => { bg.tint = 0xffffff; });

            return { container: c, draw, intrinsicWidth, label, bg };
        }

        const aboutBtn = makeButton({ text: 'ABOUT', fill: BTN_DARK, align: 'left' });
        const goBtn = makeButton({ text: 'GO TO THE ARCHIVE', fill: BTN_LIGHT, icon: 'arrow' });
        const closeBtn = makeButton({ text: 'Return', fill: BTN_DARK, icon: 'back' });

        intro.addChild(aboutBtn.container);
        intro.addChild(goBtn.container);
        intro.addChild(closeBtn.container);

        // ──────────────────────────────────────────────────────────────
        // Layout
        // ──────────────────────────────────────────────────────────────
        let view = 'archive'; // 'archive' | 'about'

        function layout() {
            const isAbout = view === 'about';
            archiveContent.visible = !isAbout;
            aboutContent.visible = isAbout;
            aboutBtn.container.visible = !isAbout;
            goBtn.container.visible = !isAbout;
            closeBtn.container.visible = isAbout;

            // Measure inner content height for the current view
            let innerH;
            if (isAbout) {
                innerH = aboutHeading.height + 18 + aboutSubtitle.height + 22 + aboutBody.height;
            } else {
                innerH = descText.height + 30 + bigTitle.height;
            }
            const boxH = innerH + PAD * 2;

            // Anchor the box BOTTOM (and therefore the button row) at a fixed
            // position derived from the default archive view, so toggling to the
            // taller about view grows the box upward instead of shifting the
            // button / box-bottom. This keeps the ABOUT/close button and the
            // bottom edge of the text box in place across views.
            const archiveInnerH = descText.height + 30 + bigTitle.height;
            const archiveBoxH = archiveInnerH + PAD * 2;
            const archiveGroupH = archiveBoxH + BTN_GAP + BTN_H;
            const ANCHOR_BOTTOM = Math.round(cardCY - archiveGroupH / 2) + archiveBoxH;

            const boxY = ANCHOR_BOTTOM - boxH;

            // Draw box
            box.clear();
            box.beginFill(BOX_FILL);
            box.drawRoundedRect(BOX_X, boxY, BOX_W, boxH, 22);
            box.endFill();
            box.hitArea = new PIXI.Rectangle(BOX_X, boxY, BOX_W, boxH);

            // Place content
            const left = BOX_X + PAD;
            if (isAbout) {
                let cy = boxY + PAD;
                aboutHeading.x = left; aboutHeading.y = cy; cy += aboutHeading.height + 18;
                aboutSubtitle.x = left; aboutSubtitle.y = cy; cy += aboutSubtitle.height + 22;
                aboutBody.x = left; aboutBody.y = cy;
            } else {
                descText.x = left; descText.y = boxY + PAD;
                bigTitle.x = left; bigTitle.y = boxY + PAD + descText.height + 30;
            }

            // Button row sits below the box, spanning the box width
            const rowY = boxY + boxH + BTN_GAP;

            if (isAbout) {
                const w = closeBtn.intrinsicWidth();
                closeBtn.draw(w);
                closeBtn.container.x = BOX_X;
                closeBtn.container.y = rowY;
            } else {
                const aboutW = aboutBtn.intrinsicWidth();
                aboutBtn.draw(aboutW);
                aboutBtn.container.x = BOX_X;
                aboutBtn.container.y = rowY;

                const goX = BOX_X + aboutW + 12;
                const goW = (BOX_X + BOX_W) - goX;
                goBtn.draw(goW);
                goBtn.container.x = goX;
                goBtn.container.y = rowY;
            }
        }

        // ──────────────────────────────────────────────────────────────
        // Interactions
        // ──────────────────────────────────────────────────────────────
        aboutBtn.container.on('pointertap', (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            view = 'about';
            layout();
        });

        closeBtn.container.on('pointertap', (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            view = 'archive';
            layout();
        });

        // Click anywhere outside the box (on the white card) returns from the
        // about view. Taps on the box / buttons stop propagation, so only
        // outside clicks reach here.
        whiteBox.on('pointertap', () => {
            if (view === 'about') {
                view = 'archive';
                layout();
            }
        });

        layout();

        // ──────────────────────────────────────────────────────────────
        // Random preview image (left gap between container and white card)
        // ──────────────────────────────────────────────────────────────
        (async function loadPreviewImage() {
            // Try loading 0-4 in parallel, keep whichever succeed
            const attempts = [];
            for (let i = 0; i < 5; i++) {
                attempts.push(
                    PIXI.Assets.load(`assets/previewimages/${i}.png`).catch(() => null)
                );
            }
            const results = await Promise.all(attempts);
            const previewTextures = results.filter(Boolean);

            if (previewTextures.length === 0) return;

            const tex = previewTextures[Math.floor(Math.random() * previewTextures.length)];
            const previewSprite = new PIXI.Sprite(tex);

            // Scale to fit the left gap width, maintain aspect ratio
            const gapWidth = cardX - 20;
            const nativeW = tex.width;
            const nativeH = tex.height;
            const scale = Math.min(gapWidth / nativeW, stageHeight / nativeH);
            previewSprite.scale.set(scale);

            previewSprite.anchor.set(1, 0.5);
            previewSprite.x = cardX;
            previewSprite.y = stageHeight / 2;
            previewSprite.eventMode = 'static';
            previewSprite.cursor = 'pointer';
            // Bottom of the intro stack so the lizard can sit above the image
            // but still below the white card.
            intro.addChildAt(previewSprite, 0);

            // Load lizard frames for click-to-spawn
            const lizardFrames = [];
            for (let f = 0; f < 11; f++) {
                try {
                    lizardFrames.push(await PIXI.Assets.load(`assets/lizard/${f}.png`));
                } catch (e) {
                    console.warn(`Preview lizard: could not load frame ${f}`, e);
                    break;
                }
            }
            console.log(`Preview lizard: loaded ${lizardFrames.length} frames`);

            // Only one lizard runs at a time; hover does nothing while active.
            let lizardActive = false;

            previewSprite.on('pointerover', (e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                if (lizardFrames.length === 0) return;
                if (lizardActive) return;
                lizardActive = true;

                const sprite = new PIXI.AnimatedSprite(lizardFrames);
                sprite.anchor.set(0.5);
                sprite.animationSpeed = 0.15;
                sprite.scale.set(1);
                sprite.play();

                // Insert directly above the decorative image, but below the
                // white card (which now sits above the image).
                const previewIdx = intro.getChildIndex(previewSprite);
                intro.addChildAt(sprite, previewIdx + 1);

                // Gentle path through the gap. The lizard enters above the top
                // edge and exits below the bottom edge, swaying to one side in a
                // single soft arc (no sharp turns). Once it completes a pass it
                // reverses and travels back, alternating direction indefinitely.
                const gapW = cardX;
                const xCenter = gapW * (0.4 + Math.random() * 0.2);       // horizontal centre (fixed for the run)
                let amplitude = gapW * (0.18 + Math.random() * 0.12);     // gentle sideways sway
                let curveDir = Math.random() < 0.5 ? 1 : -1;              // bulge left or right
                let yStart = -250;                                        // above the top edge
                let yEnd = stageHeight + 250;                             // below the bottom edge

                sprite.x = xCenter;
                sprite.y = yStart;

                let t = 0;
                const PATH_SPEED = 0.001;
                let lastX = sprite.x, lastY = sprite.y;
                let paused = false;

                const onTick = () => {
                    if (paused) return;

                    t += PATH_SPEED;

                    if (t >= 1) {
                        // Reverse direction and start a fresh arc back the other way.
                        t = 0;
                        const tmp = yStart; yStart = yEnd; yEnd = tmp;
                        amplitude = gapW * (0.18 + Math.random() * 0.12);
                        curveDir = Math.random() < 0.5 ? 1 : -1;
                        lastX = sprite.x;
                        lastY = sprite.y;

                        // Rest 3–6s off-screen before heading back.
                        paused = true;
                        setTimeout(() => { paused = false; }, 12000 + Math.random() * 8000);
                        return;
                    }

                    // Single half-sine bulge for a soft curve; linear traverse.
                    const nx = xCenter + Math.sin(t * Math.PI) * amplitude * curveDir;
                    const ny = yStart + (yEnd - yStart) * t;

                    const angle = Math.atan2(ny - lastY, nx - lastX);
                    sprite.rotation = angle + Math.PI / 2;

                    sprite.x = nx;
                    sprite.y = ny;
                    lastX = nx;
                    lastY = ny;
                };

                app.ticker.add(onTick);
            });
        })();

        // ──────────────────────────────────────────────────────────────
        // Texture loading (background)
        // ──────────────────────────────────────────────────────────────
        const textureLoadingPromise = (async () => {
            let index = 0;
            for (const folderPath of folderPaths) {
                const zipUrl = `${folderPath}/textures.zip`;
                await downloadAndExtractZip(zipUrl, index);
                index++;
            }

            const maxRetries = 3;
            const retryDelay = 1000;

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
                [interactiveBgTexture, restartButtonTexture, whitebgTexture, indexBg, whiteCircleBg, leavesTexture, dragonflyTexture, frogTexture] = await Promise.all([
                    loadTextureWithRetry('assets/interactive_bg.png'),
                    loadTextureWithRetry('assets/RESET.png'),
                    loadTextureWithRetry('assets/bg_white.png'),
                    loadTextureWithRetry('assets/index_bg.png'),
                    loadTextureWithRetry('assets/white_circle_bg.png'),
                    loadTextureWithRetry('assets/LEAVES2.png'),
                    loadTextureWithRetry('assets/DRAGONFLY3.png'),
                    loadTextureWithRetry('assets/FROG1.png'),
                ]);

                // Warm the Assets cache for sprites used later in InfoSection
                // (loaded there via PIXI.Sprite.from). Not captured into the
                // exported texture variables — just preloaded so they're ready.
                await Promise.all([
                    loadTextureWithRetry('assets/PLUS.png'),
                    loadTextureWithRetry('assets/HELP.png'),
                ]);

                texturesLoaded = true;
            } catch (error) {
                console.error('Failed to load background textures:', error);
                goBtn.label.text = 'ERROR — REFRESH';
            }
        })();

        // ──────────────────────────────────────────────────────────────
        // Launch the archive
        // ──────────────────────────────────────────────────────────────
        goBtn.container.on('pointertap', async (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (isLoading) return;

            if (!texturesLoaded) {
                isLoading = true;
                goBtn.label.text = 'LOADING…';
                try {
                    await textureLoadingPromise;
                } catch (error) {
                    console.error('Error loading textures:', error);
                    isLoading = false;
                    return;
                }
            }
            isLoading = false;

            intro.visible = false;

            app.stage.x = app.screen.width;

            await initInfoSection();
            await initImageSection();
            await initBottomLayout();

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
