import { app, TextureArray, folderPaths, numberOfRows, numberOfColumns, cellSize } from './Config.js';
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
        // Create organization title
        const titleText = new PIXI.Text('SHILLIM INSTITUTE', {
            fontFamily: 'Trebuchet MS',
            fontSize: 30,
            fill: 'black',
            align: 'left'
        });
        titleText.anchor.set(0, 0.5);
        titleText.x = app.screen.width / 2 - 250;
        titleText.y = app.screen.height / 2 - 60;
        app.stage.addChild(titleText);

        // Create subtitle
        const subtitleText = new PIXI.Text('Inspiring Commitment to Action through Sustainable art practices in the Sahyadri Western Ghats India.', {
            fontFamily: 'Lucida Grande',
            fontSize: 17,
            fill: 'black',
            //fontStyle: 'italic',
            align: 'left',
            wordWrap: true,
            wordWrapWidth: 600
        });
        subtitleText.anchor.set(0, 0.5);
        subtitleText.x = app.screen.width / 2 - 250;
        subtitleText.y = titleText.y + 40;
        app.stage.addChild(subtitleText);

        // Create description
        const descriptionText = new PIXI.Text('Located in the Western Ghats, The Shillim Institute safeguards approximately 2000 acres of land in the Northern region of this mountain range, which has been declared a UNESCO World Heritage Site and a biodiversity conservation hotspot. The Institute has enlisted local communities as forest guards, and introduced thousands of native plant species, resulting in the flourishing of over a million trees comprising 64 diverse species.\n\nThe Pavna Collective is a consortium of conservation, ecology, and arts organizations, convened by the Shillim Institute. Among its initiatives, the Pavna Collective sponsors 3-6 art residencies a year, fellowships, Mapping Workshop, Cultural documentation and Skill development programs in the Sayadri ranges.', {
            fontFamily: 'Lucida Grande',
            fontSize: 15,
            fill: 'black',
            align: 'left',
            wordWrap: true,
            wordWrapWidth: 600
        });
        descriptionText.anchor.set(0, 0.5);
        descriptionText.x = app.screen.width / 2 - 250;
        descriptionText.y = subtitleText.y + 160;
        app.stage.addChild(descriptionText);

        // Create continue button
        continueText = new PIXI.Text('CONTINUE', {
            fontFamily: 'Lucida Grande',
            fontSize: 16,
            fill: '#4A90E2',
            align: 'left'
        });
        continueText.anchor.set(0, 0.45);
        continueText.x = app.screen.width / 2 - 250;
        continueText.y = descriptionText.y + 160;
        continueText.eventMode = 'static';
        continueText.cursor = 'pointer';
        continueText.visible = false;
        app.stage.addChild(continueText);

        let isLoading = false;
        let texturesLoaded = false;

        // Create loading container
        loadingContainer = new PIXI.Container();
        loadingContainer.visible = true;
        app.stage.addChild(loadingContainer);

        //Create loading text
        const loadingText = new PIXI.Text('LOADING ARCHIVE...', {
            fontFamily: 'Lucida Grande',
            fontSize: 16,
            fill: '#3092cfff',
            align: 'left',
            wordWrap: true,
            wordWrapWidth: 500
        });
        loadingText.anchor.set(0.45); //edited from 0,5 to align fonts.
        loadingText.x = app.screen.width / 2 - 178;
        loadingText.y = descriptionText.y + 160;
        loadingContainer.addChild(loadingText);

        // Create loading bar background
        const loadingBarBg = new PIXI.Graphics();
        loadingBarBg.beginFill(0xDDDDDD);
        loadingBarBg.drawRoundedRect(app.screen.width / 2 - 250, descriptionText.y + 120, 600, 10, 1);
        loadingBarBg.endFill();
        loadingContainer.addChild(loadingBarBg);

        // Create loading bar fill
        const loadingBarFill = new PIXI.Graphics();
        loadingBarFill.beginFill(0x4A90E2);
        loadingContainer.addChild(loadingBarFill);

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
                loadingBarFill.drawRoundedRect(
                    app.screen.width / 2 - 250,
                    descriptionText.y + 120,
                    600 * progress,
                    10,
                    1
                );
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
                ]);

                continueText.visible = true;
                loadingContainer.visible = false;
                texturesLoaded = true;
            } catch (error) {
                console.error('Failed to load background textures:', error);
                // Update loading text to show error
                descriptionText.text = 'Error loading textures. Please refresh the page.';
                descriptionText.style.fill = 0xFF0000; // Red color for error
            }
        })();

        // Handle continue button click
        continueText.on('pointertap', async () => {
            if (isLoading) return;

            // Hide organization content
            titleText.visible = false;
            subtitleText.visible = false;
            descriptionText.visible = false;
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