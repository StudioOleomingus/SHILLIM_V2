import { app, TextureArray, folderPaths, numberOfRows, numberOfColumns, cellSize } from './Config.js';
import { initInfoSection } from './InfoSection.js';
import { initImageSection } from './ImageSection.js';
import { initBottomLayout } from './BottomLayout.js';
import { startTutorial } from './Tutorial.js';

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
        //console.log('Zip file downloaded, getting array buffer...');
        const zipData = await response.arrayBuffer();
        //console.log('Array buffer received, size:', zipData.byteLength);
        
        // Load zip data
        //console.log('Creating new JSZip instance...');
        const zip = new JSZip();
        //console.log('Loading zip data...');
        await zip.loadAsync(zipData);
        //console.log('Zip loaded successfully');

        const texturePromises = [];

        // Process each file in the zip
        const files = Object.entries(zip.files);
        //console.log('Found files in zip:', files.length);
        
        for (const [filename, file] of files) {
            //console.log('Processing file:', filename);
            if (!file.dir && filename.endsWith('.png')) {
                const promise = file.async('blob').then(async (blob) => {
                    //console.log('Extracted blob for:', filename, 'size:', blob.size);
                    
                    // Create an image element
                    const img = new Image();
                    const objectUrl = URL.createObjectURL(blob);
                    
                    // Extract row and column from filename
                    const match = filename.match(/tile_(\d+)_(\d+)\.png$/);
                    if (match) {
                        const row = parseInt(match[1]);
                        const col = parseInt(match[2]);
                        //console.log(`Processing texture ${filename} for position [${row}][${col}]`);
                        
                        // Create a promise that resolves when the image loads
                        const imageLoadPromise = new Promise((resolve, reject) => {
                            img.onload = () => {
                                // Create a canvas and draw the image
                                const canvas = document.createElement('canvas');
                                canvas.width = img.width;
                                canvas.height = img.height;
                                const ctx = canvas.getContext('2d');
                                ctx.drawImage(img, 0, 0);
                                
                                // Create PIXI texture from canvas
                                const texture = PIXI.Texture.from(canvas);
                                
                                // Create and configure sprite
                                const sprite = new PIXI.Sprite(texture);
                                sprite.width = cellSize;
                                sprite.height = cellSize;
                                sprite.x = col * cellSize;
                                sprite.y = row * cellSize;
                                
                                // Store in texture array
                                TextureArray[index][row][col] = sprite;
                                
                                // Clean up
                                URL.revokeObjectURL(objectUrl);
                                resolve();
                            };
                            
                            img.onerror = () => {
                                URL.revokeObjectURL(objectUrl);
                                reject(new Error(`Failed to load image for ${filename}`));
                            };
                        });
                        
                        // Set the image source to start loading
                        img.src = objectUrl;
                        return imageLoadPromise;
                    } else {
                        //console.warn('Invalid filename format:', filename);
                        URL.revokeObjectURL(objectUrl);
                    }
                }).catch(error => {
                    //console.error('Error processing file:', filename, error);
                });
                
                texturePromises.push(promise);
            }
        }

        // Wait for all files to be processed
        //console.log('Waiting for all textures to be processed...');
        await Promise.all(texturePromises.filter(p => p)); // Filter out undefined promises

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
                    loadTextureWithRetry('assets/restart_bg.png'),
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

            // Initialize sections
            await initInfoSection();
            await initImageSection();
            await initBottomLayout();

            // Start the tutorial overlay
            startTutorial();
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