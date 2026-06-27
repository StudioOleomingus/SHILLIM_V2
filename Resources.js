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

// Bird sprite for the landing page
let birdSprite = null;
let birdTextures = [];

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

        const PLAY_GAP = 14;
        const boxX = interactiveRect.x + PLAY_GAP;
        const boxY = PLAY_GAP;
        const boxW = interactiveRect.width - PLAY_GAP * 2;
        const boxH = stageHeight - PLAY_GAP * 2;

        const intro = new PIXI.Container();
        app.stage.addChild(intro);

        const whiteBox = new PIXI.Graphics();
        whiteBox.beginFill(0xFFFFFF);
        whiteBox.drawRoundedRect(boxX, boxY, boxW, boxH, 28);
        whiteBox.endFill();
        intro.addChild(whiteBox);

        const TEXT_LEFT = boxX + 22;
        const CONTENT_LEFT = TEXT_LEFT;
        const CONTENT_WRAP = 760;

        const WEBSITE_DESC = 'This website is an interactive repository of projects by the Shillim Institute. It encompasses work ranging from art residencies and mapping workshops to ecological surveys and reforestation programs, as well as educational initiatives and community outreach.\n\nThe archive invites visitors to draw new associations between these varied works, situating each project within the landscape of the Sahyadris from which they emerge.';

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

        const bigTitle = new PIXI.Text('THE SHILLIM ARCHIVE', {
            fontFamily: 'Hind Madurai', fontWeight: '520', fontSize: 120, fill: 0xa4a4a4
        });
        bigTitle.anchor.set(0, 1);
        bigTitle.x = TEXT_LEFT;
        bigTitle.y = boxY + boxH - 18;
        intro.addChild(bigTitle);

        const BAR_X = TEXT_LEFT;
        const BAR_W = boxW - (TEXT_LEFT - boxX) * 2;
        const BAR_Y = bigTitle.y - bigTitle.height - 30;

        const headingText = new PIXI.Text('', {
            fontFamily: 'Hind Madurai', fontSize: 24, fill: 0x222222,
            wordWrap: true, wordWrapWidth: CONTENT_WRAP, lineHeight: 32
        });
        headingText.x = CONTENT_LEFT;
        headingText.visible = false;
        intro.addChild(headingText);

        const bodyText = new PIXI.Text(WEBSITE_DESC, {
            fontFamily: 'Hind Madurai', fontSize: 20, fill: 0x222222,
            align: 'justify',
            wordWrap: true, wordWrapWidth: CONTENT_WRAP, lineHeight: 25.5
        });
        bodyText.x = CONTENT_LEFT;
        intro.addChild(bodyText);

        const DESC_TOP = BAR_Y - 28 - bodyText.height;

        function layoutContent() {
            if (selectedInstitute === -1) {
                bodyText.y = DESC_TOP;
            } else {
                let cy = DESC_TOP;
                if (headingText.visible && headingText.text) {
                    headingText.y = cy;
                    cy += headingText.height + 24;
                }
                bodyText.y = cy;
            }
        }

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

        let selectedInstitute = -1;
        const nameItems = [];
        const NAME_X = 40;
        const NAME_GAP = 70;
        const NAME_PAD_X = 27;
        const NAME_PAD_Y = 16;

        const sampleLabel = new PIXI.Text('A', { fontFamily: 'Hind Madurai', fontWeight: '200', fontSize: 20 });
        const NAME_CAP_H = sampleLabel.height + NAME_PAD_Y * 2;
        sampleLabel.destroy();
        const NAME_GROUP_H = (institutes.length - 1) * NAME_GAP + NAME_CAP_H;
        const NAME_Y0 = Math.round(app.screen.height / 2 - NAME_GROUP_H / 2);

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

            // Reset bird to default (index 2)
            if (birdSprite && birdTextures[2]) {
                birdSprite.texture = birdTextures[2];
            }
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

            // Swap bird to match selected institute
            if (birdSprite && birdTextures[i % 6]) {
                birdSprite.texture = birdTextures[i % 6];
            }
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

            const capW = NAME_CAP_W;
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

            item.on('pointerover', () => { if (selectedInstitute !== i) bg.tint = 0xe2e2e2; });
            item.on('pointerout', () => { applyNameStyles(); });
            item.on('pointertap', (e) => {
                if (e && e.stopPropagation) e.stopPropagation();
                selectInstitute(i);
            });

            intro.addChild(item);
            nameItems.push({ item, label, bg });
        });

        // ── Bird sprite (on the white card area) ──
        birdSprite = new PIXI.Sprite();
        birdSprite.anchor.set(0.5, 0.5);
        birdSprite.x = boxX + 200;
        birdSprite.y = NAME_Y0 + 3 * NAME_GAP + NAME_CAP_H / 2;
        birdSprite.scale.set(0.3, 0.3);
        birdSprite.alpha = 1;
        birdSprite.eventMode = 'none';  // clicks pass through to buttons
        intro.addChild(birdSprite);

        // Load 6 bird images, default to index 2
        birdTextures = [];
        for (let i = 0; i < 6; i++) {
            PIXI.Assets.load(`assets/starting-page/bird/${i}.png`).then(tex => {
                birdTextures[i] = tex;
                if (i === 2 && birdSprite) birdSprite.texture = tex;
            }).catch(() => {
                birdTextures[i] = null;
            });
        }

        // Click anywhere outside a name returns to the default title view.
        app.stage.eventMode = 'static';
        app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height);
        app.stage.on('pointertap', () => {
            if (selectedInstitute !== -1) showDefault();
        });

        showDefault();

        const textureLoadingPromise = (async () => {
            let index = 0;
            const totalFolders = folderPaths.length;

            for (const folderPath of folderPaths) {
                const zipUrl = `${folderPath}/textures.zip`;
                await downloadAndExtractZip(zipUrl, index);
                
                const progress = (index + 1) / totalFolders;
                loadingBarFill.clear();
                loadingBarFill.beginFill(0x4A90E2);
                loadingBarFill.drawRoundedRect(BAR_X, BAR_Y, BAR_W * progress, 20, 10);
                loadingBarFill.endFill();
                
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
                    loadTextureWithRetry('assets/PLUS.png'),
                    loadTextureWithRetry('assets/HELP.png'),
                ]);

                texturesLoaded = true;
                if (selectedInstitute === -1) {
                    continueText.visible = true;
                    loadingContainer.visible = false;
                }
            } catch (error) {
                console.error('Failed to load background textures:', error);
                bodyText.text = 'Error loading textures. Please refresh the page.';
                bodyText.style.fill = 0xFF0000;
            }
        })();

        continueText.on('pointertap', async (e) => {
            if (e && e.stopPropagation) e.stopPropagation();
            if (isLoading) return;

            bigTitle.visible = false;
            headingText.visible = false;
            bodyText.visible = false;
            continueText.visible = false;

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