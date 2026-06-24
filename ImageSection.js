import { app, TextureArray, numberOfRows, numberOfColumns, cellSize, interactiveRect, stageSize, stageHeight, GridCell, gridCells, DragDirection, DIRECTION_COLORS, PLAIN_COLORS, projectType } from './Config.js';
import { getRandomSelectionRect } from './Utils.js';
import { archiveIndexValueLabelText } from './InfoSection.js';
import { updateSectionSizes, updateTextBox } from './BottomLayout.js';
import { interactiveBgTexture, restartButtonTexture, whitebgTexture, leavesTexture, dragonflyTexture, frogTexture } from './Resources.js';
import { tutorialDragDone, tutorialSurroundDone } from './Tutorial.js';
import { initLizardAnimator, spawnLizard, setSpawnPoint } from './LizardAnimator.js';

let previousSurroundedGroupsLength = 0;
let tempGridCells = [];
let surroundedGroupsContainer = new PIXI.Container();

let currentAudio = null;

function playAudio(audioPath) {
    // Stop any currently playing audio
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Create audio element
    const audio = new Audio(audioPath);
    audio.play();
    currentAudio = audio;

    // Start fade out when the audio is near the end
    audio.addEventListener('timeupdate', () => {
        if (audio.currentTime >= audio.duration - 15) {
            const timeLeft = audio.duration - audio.currentTime;
            audio.volume = timeLeft / 15;
        }
    });

    // Clean up when audio ends
    audio.addEventListener('ended', () => {
        currentAudio = null;
    });
}

async function initImageSection() {
    try {
        // Add keyboard event listeners for audio playback
        window.addEventListener('keydown', (event) => {
            switch(event.key) {
                case '1':
                    playAudio('assets/geeqtwith15sec fadeout.mp4');
                    break;
                case '2':
                    playAudio('assets/shillimmorningchorus30sec.mp4');
                    break;
                case '3':
                    playAudio('assets/jigneshtune.m4v');
                    break;
            }
        });

        const DirectionalTextureArray = {
            Top: TextureArray[0],           // ART
            TopRight: TextureArray[1],      // COMMUNITY
            BottomRight: TextureArray[2],   // ECOLOGY
            Bottom: TextureArray[3],        // RESEARCH
            BottomLeft: TextureArray[4],    // HEALTH
            TopLeft: TextureArray[5]        // EDUCATION
        };

        let currentDragDirection;

        // Category is now chosen from the picker (see below) instead of drag direction.
        // Defaults to the first category (ART) so painting works before any picker click.
        let selectedCategory = DragDirection.Top;

        const container = document.getElementById('app-container');

        // Create a container for the image section
        const imageContainer = new PIXI.Container();
        imageContainer.x = interactiveRect.x;  // Position from left
        imageContainer.y = interactiveRect.y;    // Position from top
        imageContainer.width = interactiveRect.width;
        imageContainer.height = interactiveRect.height;
        imageContainer.eventMode = 'static';

        // Initialise the lizard animator — must be called after imageContainer is created
        initLizardAnimator(imageContainer);
        
        // Class to track texture statistics
        class TextureStats {
            constructor() {
                this.textures = {
                    [DragDirection.Top]: 0,
                    [DragDirection.TopRight]: 0,
                    [DragDirection.BottomRight]: 0,
                    [DragDirection.Bottom]: 0,
                    [DragDirection.BottomLeft]: 0,
                    [DragDirection.TopLeft]: 0
                };
                this.totalCells = numberOfRows * numberOfColumns;
                this.surroundedEmptyCells = 0;
                this.surroundedGroups = [];
                // Create a 2D grid to track filled cells
                this.grid = Array(numberOfRows).fill().map(() => 
                    Array(numberOfColumns).fill(false)
                );
                // Create a 2D grid to track visited cells during group detection
                this.visited = Array(numberOfRows).fill().map(() => 
                    Array(numberOfColumns).fill(false)
                );

                this.topPercentage = '0';
                this.topRightPercentage = '0';
                this.bottomRightPercentage = '0';
                this.bottomPercentage = '0';
                this.bottomLeftPercentage = '0';
                this.topLeftPercentage = '0';
            }

            // Helper function to check if a cell is within grid bounds
            isValidCell(row, col) {
                return row >= 0 && row < numberOfRows && col >= 0 && col < numberOfColumns;
            }

            // Helper function to find connected empty cells
            findConnectedEmptyCells(row, col, group) {
                if (!this.isValidCell(row, col) || this.visited[row][col] || this.grid[row][col]) {
                    return;
                }

                this.visited[row][col] = true;
                group.push({row, col});

                // Check 4-connected neighbors (up, right, down, left)
                const neighbors = [[-1, 0], [0, 1], [1, 0], [0, -1]];
                for (const [dr, dc] of neighbors) {
                    this.findConnectedEmptyCells(row + dr, col + dc, group);
                }
            }

            // Check if a group of cells is completely surrounded by filled cells
            isGroupSurrounded(group) {
                for (const {row, col} of group) {
                    const neighbors = [
                        [-1, -1], [-1, 0], [-1, 1],
                        [0, -1],           [0, 1],
                        [1, -1],  [1, 0],  [1, 1]
                    ];

                    for (const [dr, dc] of neighbors) {
                        const newRow = row + dr;
                        const newCol = col + dc;
                        
                        // If neighbor is outside grid, group is not surrounded
                        if (!this.isValidCell(newRow, newCol)) return false;
                        
                        // If neighbor is empty and not part of the group, group is not surrounded
                        if (!this.grid[newRow][newCol] && 
                            !group.some(cell => cell.row === newRow && cell.col === newCol)) {
                            return false;
                        }
                    }
                }
                return true;
            }

            updateSections() {
                // Calculate total filled cells
                const totalFilled = Object.values(this.textures).reduce((sum, count) => sum + count, 0);
                
                if (totalFilled === 0) {
                    // If no cells are filled, make all sections equal
                    updateSectionSizes(0, 0, 0, 0, 0, 0);
                    return;
                }

                // Calculate percentages based on filled cells for 6 directions
                this.topPercentage = ((this.textures[DragDirection.Top] / totalFilled) * 100).toFixed(2);
                this.topRightPercentage = ((this.textures[DragDirection.TopRight] / totalFilled) * 100).toFixed(2);
                this.bottomRightPercentage = ((this.textures[DragDirection.BottomRight] / totalFilled) * 100).toFixed(2);
                this.bottomPercentage = ((this.textures[DragDirection.Bottom] / totalFilled) * 100).toFixed(2);
                this.bottomLeftPercentage = ((this.textures[DragDirection.BottomLeft] / totalFilled) * 100).toFixed(2);
                this.topLeftPercentage = ((this.textures[DragDirection.TopLeft] / totalFilled) * 100).toFixed(2);

                // Update section sizes with 6 values
                updateSectionSizes(
                    parseFloat(this.topPercentage),
                    parseFloat(this.topRightPercentage),
                    parseFloat(this.bottomRightPercentage),
                    parseFloat(this.bottomPercentage),
                    parseFloat(this.bottomLeftPercentage),
                    parseFloat(this.topLeftPercentage)
                );

                archiveIndexValueLabelText.text = (this.surroundedGroups.length).toString();
            }

            addTexture(direction, row, col) {
                this.textures[direction]++;
                this.grid[row][col] = true;
                this.updateSurroundedEmptyCells();
                this.updateSections();
            }

            removeTexture(direction, row, col) {
                if (this.textures[direction] > 0) {
                    this.textures[direction]--;
                    this.grid[row][col] = false;
                    this.updateSurroundedEmptyCells();
                    this.updateSections();
                }
            }

            updateSurroundedEmptyCells() {
                this.surroundedEmptyCells = 0;
                this.surroundedGroups = [];
                
                // Reset visited grid
                for (let row = 0; row < numberOfRows; row++) {
                    for (let col = 0; col < numberOfColumns; col++) {
                        this.visited[row][col] = false;
                    }
                }

                // Find all groups of connected empty cells
                for (let row = 0; row < numberOfRows; row++) {
                    for (let col = 0; col < numberOfColumns; col++) {
                        if (!this.visited[row][col] && !this.grid[row][col]) {
                            const group = [];
                            this.findConnectedEmptyCells(row, col, group);
                            
                            // Check if this group is surrounded
                            if (group.length > 0 && this.isGroupSurrounded(group)) {
                                this.surroundedGroups.push(group);
                                this.surroundedEmptyCells += group.length;
                            }
                        }
                    }
                }
            }

            /* printStats() {
                console.log('\nTexture Statistics:');
                for (const [direction, count] of Object.entries(this.textures)) {
                    const percentage = ((count / this.totalCells) * 100).toFixed(2);
                    console.log(`${direction}: ${count} cells (${percentage}%)`);
                }
                const totalUsed = Object.values(this.textures).reduce((a, b) => a + b, 0);
                const totalPercentage = ((totalUsed / this.totalCells) * 100).toFixed(2);
                console.log(`Total Used: ${totalUsed} cells (${totalPercentage}%)`);
                
                const surroundedPercentage = ((this.surroundedEmptyCells / this.totalCells) * 100).toFixed(2);
                console.log(`Surrounded Empty Cells: ${this.surroundedEmptyCells} (${surroundedPercentage}%)`);
                console.log(`Number of surrounded groups: ${this.surroundedGroups.length}`);
                this.surroundedGroups.forEach((group, index) => {
                    console.log(`Group ${index + 1} size: ${group.length} cells`);
                });
                
                // Also update sections when printing stats
                this.updateSections();
            } */
        }

        // Create instance of TextureStats
        let textureStats = new TextureStats();

        // Handle window resizing
        function resize() {
            
            console.log('container.clientHeight: ',container.clientHeight);

            interactiveRect.height -= (1000 -container.clientHeight);

            textureStats.updateSections();
        }

        // Initial resize
        resize();

        // Add window resize listener
        window.addEventListener('resize', resize);

        // Helper function to update sprite's corner mask
        const updateSpriteCornerMask = (sprite, row, col, isCorner, cornerPosition) => {
            // Check if sprite or its position is null
            if (!sprite || !sprite.position || sprite.position._x === null || sprite.position._y === null) {
                return sprite;
            }

            // Remove any existing mask
            if (sprite.mask) {
                sprite.mask.destroy();
                sprite.mask = null;
            }

            if (isCorner) {
                const cornerRadius = 20;
                const mask = new PIXI.Graphics();
                mask.beginFill(0xFFFFFF);
                
                // Calculate absolute coordinates
                const x = col * cellSize;
                const y = row * cellSize;
                
                // Create path for rounded corner only at specific corner
                switch(cornerPosition) {
                    case 'topLeft':
                        mask.moveTo(x + cornerRadius, y);
                        mask.arcTo(x, y, x, y + cornerRadius, cornerRadius);
                        mask.lineTo(x, y + cellSize);
                        mask.lineTo(x + cellSize, y + cellSize);
                        mask.lineTo(x + cellSize, y);
                        break;
                    case 'topRight':
                        mask.moveTo(x, y);
                        mask.lineTo(x + cellSize - cornerRadius, y);
                        mask.arcTo(x + cellSize, y, x + cellSize, y + cornerRadius, cornerRadius);
                        mask.lineTo(x + cellSize, y + cellSize);
                        mask.lineTo(x, y + cellSize);
                        break;
                    case 'bottomLeft':
                        mask.moveTo(x, y);
                        mask.lineTo(x + cellSize, y);
                        mask.lineTo(x + cellSize, y + cellSize);
                        mask.lineTo(x + cornerRadius, y + cellSize);
                        mask.arcTo(x, y + cellSize, x, y + cellSize - cornerRadius, cornerRadius);
                        break;
                    case 'bottomRight':
                        mask.moveTo(x, y);
                        mask.lineTo(x + cellSize, y);
                        mask.lineTo(x + cellSize, y + cellSize - cornerRadius);
                        mask.arcTo(x + cellSize, y + cellSize, x + cellSize - cornerRadius, y + cellSize, cornerRadius);
                        mask.lineTo(x, y + cellSize);
                        break;
                }
                mask.closePath();
                mask.endFill();
                
                // Add mask to the container and set it as sprite's mask
                gridContainer.addChild(mask);
                sprite.mask = mask;
            }
            return sprite;
        };

        // Helper function to create sprite with optional corner masking
        const createSpriteWithMask = (texture, row, col, isCorner, cornerPosition) => {
            const sprite = new PIXI.Sprite(texture);
            sprite.width = cellSize;
            sprite.height = cellSize;
            sprite.x = col * cellSize;
            sprite.y = row * cellSize;

            if (isCorner) {
                const cornerRadius = 20;
                const mask = new PIXI.Graphics();
                mask.beginFill(0xFFFFFF);
                
                // Create path for rounded corner only at specific corner
                switch(cornerPosition) {
                    case 'topLeft':
                        mask.moveTo(sprite.x + cornerRadius, sprite.y);
                        mask.arcTo(sprite.x, sprite.y, sprite.x, sprite.y + cornerRadius, cornerRadius);
                        mask.lineTo(sprite.x, sprite.y + cellSize);
                        mask.lineTo(sprite.x + cellSize, sprite.y + cellSize);
                        mask.lineTo(sprite.x + cellSize, sprite.y);
                        break;
                    case 'topRight':
                        mask.moveTo(sprite.x, sprite.y);
                        mask.lineTo(sprite.x + cellSize - cornerRadius, sprite.y);
                        mask.arcTo(sprite.x + cellSize, sprite.y, sprite.x + cellSize, sprite.y + cornerRadius, cornerRadius);
                        mask.lineTo(sprite.x + cellSize, sprite.y + cellSize);
                        mask.lineTo(sprite.x, sprite.y + cellSize);
                        break;
                    case 'bottomLeft':
                        mask.moveTo(sprite.x, sprite.y);
                        mask.lineTo(sprite.x + cellSize, sprite.y);
                        mask.lineTo(sprite.x + cellSize, sprite.y + cellSize);
                        mask.lineTo(sprite.x + cornerRadius, sprite.y + cellSize);
                        mask.arcTo(sprite.x, sprite.y + cellSize, sprite.x, sprite.y + cellSize - cornerRadius, cornerRadius);
                        break;
                    case 'bottomRight':
                        mask.moveTo(sprite.x, sprite.y);
                        mask.lineTo(sprite.x + cellSize, sprite.y);
                        mask.lineTo(sprite.x + cellSize, sprite.y + cellSize - cornerRadius);
                        mask.arcTo(sprite.x + cellSize, sprite.y + cellSize, sprite.x + cellSize - cornerRadius, sprite.y + cellSize, cornerRadius);
                        mask.lineTo(sprite.x, sprite.y + cellSize);
                        break;
                }
                mask.closePath();
                mask.endFill();
                sprite.mask = mask;
                gridContainer.addChild(mask);
            }

            return sprite;
        };

        // Function to add random cells around selection
        const addRandomCellsAroundSelection = (startRow, startCol, endRow, endCol) => {
            const numCells = Math.floor(Math.random() * 2) + 2; // Random number between 2-3
            const positions = [];
            //recentlyAddedCells = []; // Reset the tracking array
            
            // Get all possible positions around the selection
            for (let row = startRow - 1; row <= endRow + 1; row++) {
                for (let col = startCol - 1; col <= endCol + 1; col++) {
                    // Skip if position is:
                    // 1. Inside selection
                    // 2. Out of bounds
                    // 3. At or adjacent to corners
                    const isCornerOrAdjacent = (
                        // Top-left corner and adjacent positions
                        (row === startRow - 1 && col === startCol - 1) || // corner
                        (row === startRow - 1 && col === startCol) ||     // top adjacent
                        (row === startRow && col === startCol - 1) ||     // left adjacent
                        
                        // Top-right corner and adjacent positions
                        (row === startRow - 1 && col === endCol + 1) ||   // corner
                        (row === startRow - 1 && col === endCol) ||       // top adjacent
                        (row === startRow && col === endCol + 1) ||       // right adjacent
                        
                        // Bottom-left corner and adjacent positions
                        (row === endRow + 1 && col === startCol - 1) ||   // corner
                        (row === endRow + 1 && col === startCol) ||       // bottom adjacent
                        (row === endRow && col === startCol - 1) ||       // left adjacent
                        
                        // Bottom-right corner and adjacent positions
                        (row === endRow + 1 && col === endCol + 1) ||     // corner
                        (row === endRow + 1 && col === endCol) ||         // bottom adjacent
                        (row === endRow && col === endCol + 1)            // right adjacent
                    );

                    // Calculate pixel position
                    const pixelX = col * cellSize;
                    const pixelY = row * cellSize;
                    
                    // Check if position is within imageContainer bounds
                    const isWithinBounds = 
                        pixelX >= 0 && 
                        pixelX + cellSize <= imageContainer.width && 
                        pixelY >= 0 && 
                        pixelY + cellSize <= imageContainer.height;

                    if (row >= 0 && row < numberOfRows && 
                        col >= 0 && col < numberOfColumns &&
                        !(row >= startRow && row <= endRow && col >= startCol && col <= endCol) &&
                        !isCornerOrAdjacent &&
                        isWithinBounds) {
                        positions.push({row, col});
                    }
                }
            }

            // Randomly select positions
            for (let i = 0; i < numCells && positions.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * positions.length);
                const {row, col} = positions.splice(randomIndex, 1)[0];
                
                const originalSprite = DirectionalTextureArray[currentDragDirection][row][col];
                if (originalSprite) {
                    const newSprite = new PIXI.Sprite(originalSprite.texture);
                    newSprite.width = cellSize;
                    newSprite.height = cellSize;
                    newSprite.x = col * cellSize;
                    newSprite.y = row * cellSize;
                    
                    const cell = new GridCell(row, col, newSprite);
                    gridCells.push(cell);
                    gridContainer.addChild(newSprite);
                    //recentlyAddedCells.push({row, col}); // Track the added cell
                    textureStats.addTexture(currentDragDirection, row, col); // Track new texture
                }
            }
        };

        // Function to remove a random cell around selection
        const removeRandomCellAroundSelection = (startRow, startCol, endRow, endCol) => {
            const positions = [];
            
            // Get all edge positions inside the selection area
            for (let row = startRow; row <= endRow; row++) {
                for (let col = startCol; col <= endCol; col++) {
                    // Check if the position is on the edge of selection (inside)
                    const isEdge = (
                        row === startRow || // top edge
                        row === endRow ||   // bottom edge
                        col === startCol || // left edge
                        col === endCol      // right edge
                    );

                    // Skip corners
                    const isCorner = (
                        (row === startRow && col === startCol) || // top-left
                        (row === startRow && col === endCol) ||   // top-right
                        (row === endRow && col === startCol) ||   // bottom-left
                        (row === endRow && col === endCol)        // bottom-right
                    );

                    if (isEdge && !isCorner) {
                        // Check for cells in adjacent positions based on which edge we're on
                        let hasAdjacentCell = false;

                        if (row === startRow) { // Top edge
                            // Check for cell above
                            hasAdjacentCell = gridCells.some(cell => 
                                cell.row === row - 1 && cell.col === col
                            );
                        } else if (row === endRow) { // Bottom edge
                            // Check for cell below
                            hasAdjacentCell = gridCells.some(cell => 
                                cell.row === row + 1 && cell.col === col
                            );
                        } else if (col === startCol) { // Left edge
                            // Check for cell to the left
                            hasAdjacentCell = gridCells.some(cell => 
                                cell.row === row && cell.col === col - 1
                            );
                        } else if (col === endCol) { // Right edge
                            // Check for cell to the right
                            hasAdjacentCell = gridCells.some(cell => 
                                cell.row === row && cell.col === col + 1
                            );
                        }

                        // Only add position if there's no adjacent cell in the direction we're checking
                        if (!hasAdjacentCell) {
                            // Find the cell at this position
                            const cellToRemove = gridCells.find(cell => cell.row === row && cell.col === col);
                            if (cellToRemove) {
                                positions.push({row, col, cell: cellToRemove});
                            }
                        }
                    }
                }
            }

            // Randomly select one position to remove
            if (positions.length > 0) {
                const randomIndex = Math.floor(Math.random() * positions.length);
                const {row, col, cell} = positions[randomIndex];
                
                // Remove the sprite from the container
                if (cell.sprite) {
                    gridContainer.removeChild(cell.sprite);
                    // Remove the cell from gridCells array
                    const cellIndex = gridCells.indexOf(cell);
                    if (cellIndex > -1) {
                        gridCells.splice(cellIndex, 1);
                    }

                    // Determine if the removed cell is on horizontal or vertical edge
                    const isHorizontalEdge = row === startRow || row === endRow;
                    const isVerticalEdge = col === startCol || col === endCol;

                    // Update corners of adjacent cells based on edge type
                    if (isHorizontalEdge) {
                        // If cell is removed from top/bottom edge, round corners of left and right adjacent cells
                        const adjacentCells = [
                            {row: row, col: col-1},   // left
                            {row: row, col: col+1}    // right
                        ];

                        adjacentCells.forEach(({row: adjRow, col: adjCol}) => {
                            const adjacentCell = gridCells.find(cell => cell.row === adjRow && cell.col === adjCol);
                            if (adjacentCell && adjacentCell.sprite) {
                                let cornerPosition = null;
                                if (adjCol < col) {
                                    // Left cell
                                    cornerPosition = row === startRow ? 'topRight' : 'bottomRight';
                                } else {
                                    // Right cell
                                    cornerPosition = row === startRow ? 'topLeft' : 'bottomLeft';
                                }

                                if (cornerPosition) {
                                    updateSpriteCornerMask(adjacentCell.sprite, adjRow, adjCol, true, cornerPosition);
                                }
                            }
                        });
                    } else if (isVerticalEdge) {
                        // If cell is removed from left/right edge, round corners of top and bottom adjacent cells
                        const adjacentCells = [
                            {row: row-1, col: col},   // top
                            {row: row+1, col: col}    // bottom
                        ];

                        adjacentCells.forEach(({row: adjRow, col: adjCol}) => {
                            const adjacentCell = gridCells.find(cell => cell.row === adjRow && cell.col === adjCol);
                            if (adjacentCell && adjacentCell.sprite) {
                                let cornerPosition = null;
                                if (adjRow < row) {
                                    // Top cell
                                    cornerPosition = col === startCol ? 'bottomLeft' : 'bottomRight';
                                } else {
                                    // Bottom cell
                                    cornerPosition = col === startCol ? 'topLeft' : 'topRight';
                                }

                                if (cornerPosition) {
                                    updateSpriteCornerMask(adjacentCell.sprite, adjRow, adjCol, true, cornerPosition);
                                }
                            }
                        });
                    }
                }
                textureStats.removeTexture(currentDragDirection, row, col); // Track removed texture
            }
        };

        
        // ---- Play-area layout ----
        // The white play card extends down to overlap the top half of the
        // percentage bar (drawn by BottomLayout) at the very bottom. The
        // category SELECTOR bar sits *inside* the card, near its bottom edge.
        const PLAY_GAP = 14;            // margin around the white play card
        const SELECTOR_H = 52;          // height of the in-card selector bar
        const PERCENT_BAR_H = 50;       // must match BottomLayout's percentage bar
        const PERCENT_BAR_MARGIN = 12;  // gap from the very bottom
        const playX = PLAY_GAP;
        const playY = PLAY_GAP;
        const playW = interactiveRect.width - PLAY_GAP * 2;
        const playRadius = 28;
        // Card overlaps down to the vertical middle of the percentage bar.
        const percentBarTop = interactiveRect.height - PERCENT_BAR_MARGIN - PERCENT_BAR_H;
        const cardBottom = percentBarTop + PERCENT_BAR_H / 2;
        const playH = cardBottom - playY;
        // Selector bar: same width as the card, sitting inside near its bottom.
        const BAR_H = SELECTOR_H;
        const barW = playW;
        const barX = playX;
        const barY = cardBottom - 18 - SELECTOR_H;

        // Flat white play area as a rounded card
        const backgroundImage = new PIXI.Graphics();
        backgroundImage.beginFill(0xFFFFFF);
        backgroundImage.drawRoundedRect(playX, playY, playW, playH, playRadius);
        backgroundImage.endFill();

        // Mask that clips the interactive grid to the rounded card
        const playMask = new PIXI.Graphics();
        playMask.beginFill(0xFFFFFF);
        playMask.drawRoundedRect(playX, playY, playW, playH, playRadius);
        playMask.endFill();

        // Create a container for the background with effects
        const bgContainer = new PIXI.Container();

        // Add everything to the container
        bgContainer.addChild(backgroundImage);
        bgContainer.addChild(playMask);

        // Add decorative elements at bottom center
        const leaves = new PIXI.Sprite(leavesTexture);
        leaves.anchor.set(0.5, 1); // Center-bottom anchor
        leaves.x = interactiveRect.width / 2;
        leaves.y = interactiveRect.height;
        leaves.scale.set(0.8); // Adjust scale as needed
        leaves.alpha = 0.0;

        const dragonfly = new PIXI.Sprite(dragonflyTexture);
        dragonfly.anchor.set(0.5, 1);
        dragonfly.x = (interactiveRect.width / 2) + 10; // Offset to the left
        dragonfly.y = interactiveRect.height - 40;
        dragonfly.scale.set(0.6);
        dragonfly.alpha = 0.0;

        const frog = new PIXI.Sprite(frogTexture);
        frog.anchor.set(0.5, 1);
        frog.x = (interactiveRect.width / 2) + 15; // Offset to the right
        frog.y = interactiveRect.height - 10;
        frog.scale.set(0.7);
        frog.alpha = 0.0;

        bgContainer.addChild(leaves);
        bgContainer.addChild(dragonfly);
        bgContainer.addChild(frog);

        imageContainer.addChild(bgContainer);

        // Create a container for the grid
        const gridContainer = new PIXI.Container();
        gridContainer.x = 0;
        gridContainer.y = 0;

        // Create selection rectangle
        const selectionRect = new PIXI.Graphics();
        selectionRect.alpha = 0.5;
        gridContainer.addChild(selectionRect);

        // Variables to track selection
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;

        // Make grid container interactive (limited to the visible rounded play card)
        gridContainer.eventMode = 'static';
        gridContainer.hitArea = new PIXI.Rectangle(playX, playY, playW, playH);
        gridContainer.mask = playMask;

        // Mouse down event
        gridContainer.on('pointerdown', (event) => {
            isDragging = true;
            const pos = event.getLocalPosition(gridContainer);
            startX = pos.x;
            startY = pos.y;
            endX = startX;
            endY = startY;
            
            // Snap to grid
            startX = Math.floor(startX / cellSize) * cellSize;
            startY = Math.floor(startY / cellSize) * cellSize;
            
            // Clear previous selection
            selectionRect.clear();
        });

        // Create project type text
        const projectTypeText = new PIXI.Text('', {
            fontFamily: 'IBM Plex Mono',
            fontSize: 20,
            fill: 0x4A90E2,
            align: 'center'
        });
        projectTypeText.visible = false;
        gridContainer.addChild(projectTypeText);

        // Mouse move event
        gridContainer.on('pointermove', (event) => {
            if (isDragging) {
                const pos = event.getLocalPosition(gridContainer);
                endX = pos.x;
                endY = pos.y;
                
                // Snap to grid
                endX = Math.floor(endX / cellSize) * cellSize + cellSize;
                endY = Math.floor(endY / cellSize) * cellSize + cellSize;

                // Calculate dimensions in cells
                const cellsWidth = Math.abs(endX - startX) / cellSize;
                const cellsHeight = Math.abs(endY - startY) / cellSize;

                // Restrict to minimum 2x2 and maximum 5x5
                if (cellsWidth < 2) endX = startX + (endX > startX ? 2 * cellSize : -2 * cellSize);
                if (cellsWidth > 15) endX = startX + (endX > startX ? 15 * cellSize : -15 * cellSize);
                if (cellsHeight < 2) endY = startY + (endY > startY ? 2 * cellSize : -2 * cellSize);
                if (cellsHeight > 11) endY = startY + (endY > startY ? 11 * cellSize : -11 * cellSize);
                
                // Draw selection rectangle
                selectionRect.clear();
                selectionRect.beginFill(0x707070, 0.1);  // Semi-transparent grey
                
                const x = Math.min(startX, endX);
                const y = Math.min(startY, endY);
                const width = Math.abs(endX - startX);
                const height = Math.abs(endY - startY);
                
                selectionRect.drawRoundedRect(x, y, width, height,24);
                selectionRect.endFill();

                // Update project type text based on the currently picked category
                const direction = selectedCategory;
                let projectIndex = 0;
                switch(direction) {
                    case DragDirection.Top:
                        projectIndex = 0; // ART
                        break;
                    case DragDirection.TopRight:
                        projectIndex = 1; // COMMUNITY
                        break;
                    case DragDirection.BottomRight:
                        projectIndex = 2; // ECOLOGY
                        break;
                    case DragDirection.Bottom:
                        projectIndex = 3; // RESEARCH
                        break;
                    case DragDirection.BottomLeft:
                        projectIndex = 4; // HEALTH
                        break;
                    case DragDirection.TopLeft:
                        projectIndex = 5; // EDUCATION
                        break;
                }
                
                // Position text at the center of selection
                projectTypeText.text = projectType[projectIndex];
                projectTypeText.visible = true;
                projectTypeText.x = x + width/2 - projectTypeText.width/2;
                projectTypeText.y = y + height/2 - projectTypeText.height/2;
                // Bring selectionRect and text to the front, with text on top
                gridContainer.setChildIndex(selectionRect, gridContainer.children.length - 1);
                gridContainer.setChildIndex(projectTypeText, gridContainer.children.length - 1);
            } else {
                projectTypeText.visible = false;
            }
        });

        // Create restart button (placed inside the bottom control bar)
        const restartButton = new PIXI.Sprite(restartButtonTexture);
        restartButton.width = 44;
        restartButton.height = 44;
        restartButton.x = 8;
        restartButton.y = (BAR_H - 44) / 2;
        restartButton.eventMode = 'static';
        restartButton.cursor = 'pointer';
        
        
        // Hover effects
        restartButton.on('pointerover', () => {
            gsap.to(restartButton, { alpha: 0.9, duration: 0.2 });
        });
        
        restartButton.on('pointerout', () => {
            gsap.to(restartButton, { alpha: 1, duration: 0.2 });
        });
        
        // Reset functionality
        restartButton.on('pointertap', () => {

            surroundedGroupsContainer.children.forEach(cell => cell.destroy());
            surroundedGroupsContainer.removeChildren();

            // Clear all containers
            gridContainer.removeChildren();
            
            // Reset arrays and objects
            gridCells.forEach(cell => cell.destroy());
            gridCells.length = 0;
            tempGridCells.length = 0;
            
            // Reset texture stats
            textureStats = new TextureStats();
            previousSurroundedGroupsLength = 0;
            
            // Reset selection state
            isDragging = false;
            startX = startY = endX = endY = 0;
            selectionRect.clear();

            // Re-add selection rectangle to grid container
            gridContainer.addChild(selectionRect);
            gridContainer.addChild(projectTypeText);

            // Reset section sizes
            updateSectionSizes(0, 0, 0, 0, 0, 0);

            // Clear projects from InfoSection
            if (typeof window.clearAllProjects === 'function') {
                window.clearAllProjects();
            }

            archiveIndexValueLabelText.text = '0';
        });

        // Mouse up event
        gridContainer.on('pointerup', () => {
            isDragging = false;
            projectTypeText.visible = false;
            // Calculate dimensions in cells
            const cellsWidth = Math.abs(endX - startX) / cellSize;
            const cellsHeight = Math.abs(endY - startY) / cellSize;

            // Enforce minimum 2x2 and maximum 5x5 on final selection
            if (cellsWidth < 2 || cellsWidth > 15 || cellsHeight < 2 || cellsHeight > 15) {
                selectionRect.clear();
                return;
            }

            selectionRect.clear();
            let originalX1 = Math.min(startX, endX);
            let originalY1 = Math.min(startY, endY);
            let originalX2 = Math.max(startX, endX);
            let originalY2 = Math.max(startY, endY);

            // Calculate original selected cells
            let originalStartCol = Math.floor(originalX1 / cellSize);
            let originalStartRow = Math.floor(originalY1 / cellSize);
            let originalEndCol = Math.floor(originalX2 / cellSize);
            let originalEndRow = Math.floor(originalY2 / cellSize);

            // Getting random rectangle within right panel
            const randomSelectionRect = getRandomSelectionRect({ x: originalX1, y: originalY1, width: originalX2 - originalX1, height: originalY2 - originalY1 }, { x: 0, y: 0, width: stageSize, height: stageHeight });
            
            // Update coordinates based on random selection
            let x1 = randomSelectionRect.x;
            let y1 = randomSelectionRect.y;
            let x2 = randomSelectionRect.x + randomSelectionRect.width;
            let y2 = randomSelectionRect.y + randomSelectionRect.height;
            
            // Calculate selected cells
            let startCol = Math.floor(x1 / cellSize);
            let startRow = Math.floor(y1 / cellSize);
            let endCol = Math.floor(x2 / cellSize);
            let endRow = Math.floor(y2 / cellSize);

            currentDragDirection = selectedCategory;

            tempGridCells.length = 0;

            if(gridCells.length > 0){
                for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                        if (row >= 0 && row < numberOfRows && col >= 0 && col < numberOfColumns) {
                            const originalSprite = DirectionalTextureArray[currentDragDirection][row][col];
                            if (originalSprite) {
                                const newSprite = new PIXI.Sprite(originalSprite.texture);
                                newSprite.width = cellSize;
                                newSprite.height = cellSize;
                                const cell = new GridCell(row, col, newSprite);
                                tempGridCells.push(cell);
                            }
                        }
                    }
                }
            }
            else{
                for (let row = startRow; row <= endRow; row++) {
                    for (let col = startCol; col <= endCol; col++) {
                        if (row >= 0 && row < numberOfRows && col >= 0 && col < numberOfColumns) {
                            const originalSprite = DirectionalTextureArray[currentDragDirection][row][col];
                            if (originalSprite) {
                                const newSprite = new PIXI.Sprite(originalSprite.texture);
                                newSprite.width = cellSize;
                                newSprite.height = cellSize;
                                const cell = new GridCell(row, col, newSprite);
                                gridCells.push(cell);
                            }
                        }
                    }
                }
            }

            if(tempGridCells.length <= 0){

                // Show and color sprites in the original selection area
                gridCells.forEach((cell, index) => {
                    const row = originalStartRow + Math.floor(index / (originalEndCol - originalStartCol + 1));
                    const col = originalStartCol + (index % (originalEndCol - originalStartCol + 1));
                    
                    if (row <= originalEndRow && col <= originalEndCol) {
                        let sprite = cell.sprite;

                        // Check if this is a corner cell
                        const isCorner = (row === originalStartRow && col === originalStartCol) || 
                                       (row === originalStartRow && col === originalEndCol) ||
                                       (row === originalEndRow && col === originalStartCol) ||
                                       (row === originalEndRow && col === originalEndCol);
                        
                        let cornerPosition = null;
                        if (isCorner) {
                            if (row === originalStartRow && col === originalStartCol) cornerPosition = 'topLeft';
                            else if (row === originalStartRow && col === originalEndCol) cornerPosition = 'topRight';
                            else if (row === originalEndRow && col === originalStartCol) cornerPosition = 'bottomLeft';
                            else if (row === originalEndRow && col === originalEndCol) cornerPosition = 'bottomRight';
                        }
                        
                        cell.col = col;
                        cell.row = row;
                        
                        if (sprite) {
                            sprite.x = col * cellSize;
                            sprite.y = row * cellSize;
                            sprite = updateSpriteCornerMask(sprite, row, col, isCorner, cornerPosition);
                            gridContainer.addChild(sprite);
                            textureStats.addTexture(currentDragDirection, row, col); // Track new texture
                        }
                    }
                });

                // Add random cells around the selection
                addRandomCellsAroundSelection(originalStartRow, originalStartCol, originalEndRow, originalEndCol);

                // Remove a random cell around the selection
                removeRandomCellAroundSelection(originalStartRow, originalStartCol, originalEndRow, originalEndCol);

                
            }
            else{
                // Show and color sprites in the original selection area
                tempGridCells.forEach((cell, index) => {
                    const row = originalStartRow + Math.floor(index / (originalEndCol - originalStartCol + 1));
                    const col = originalStartCol + (index % (originalEndCol - originalStartCol + 1));
                    
                    if (row <= originalEndRow && col <= originalEndCol) {
                        
                        const existingCell = gridCells.find(cell => cell.row === row && cell.col === col);
                        if(existingCell){
                            gridContainer.removeChild(existingCell.sprite);
                            existingCell.sprite.destroy();
                        }

                        const sprite = cell.sprite;

                        // Check if this is a corner cell
                        const isCorner = (row === originalStartRow && col === originalStartCol) || 
                                       (row === originalStartRow && col === originalEndCol) ||
                                       (row === originalEndRow && col === originalStartCol) ||
                                       (row === originalEndRow && col === originalEndCol);
                        
                        let cornerPosition = null;
                        if (isCorner) {
                            if (row === originalStartRow && col === originalStartCol) cornerPosition = 'topLeft';
                            else if (row === originalStartRow && col === originalEndCol) cornerPosition = 'topRight';
                            else if (row === originalEndRow && col === originalStartCol) cornerPosition = 'bottomLeft';
                            else if (row === originalEndRow && col === originalEndCol) cornerPosition = 'bottomRight';
                        }

                        const newSprite = createSpriteWithMask(sprite.texture, row, col, isCorner, cornerPosition);
                        newSprite.col = col;
                        newSprite.row = row;
                        const newCell = new GridCell(row, col, newSprite);
                        gridCells.push(newCell);
                        gridContainer.addChild(newSprite);
                        textureStats.addTexture(currentDragDirection, row, col); // Track new texture
                    }
                });

                // Add random cells around the selection
                addRandomCellsAroundSelection(originalStartRow, originalStartCol, originalEndRow, originalEndCol);

                // Remove a random cell around the selection
                removeRandomCellAroundSelection(originalStartRow, originalStartCol, originalEndRow, originalEndCol);

                // Clear existing grid cells
                tempGridCells.forEach(cell => {
                    cell.destroy();
                });
                tempGridCells.length = 0;
            }
            //textureStats.printStats(); // Print updated statistics
            textureStats.updateSections();

            // Notify tutorial that a drag was completed
            tutorialDragDone();

            // If we found a new surrounded group
            if (textureStats.surroundedGroups.length > previousSurroundedGroupsLength) {

                // Remove any existing surrounded group sprites
                if (gridContainer.surroundedGroupsContainer) {
                    surroundedGroupsContainer.children.forEach(cell => cell.destroy());
                    gridContainer.removeChild(gridContainer.surroundedGroupsContainer);
                }

                gridContainer.surroundedGroupsContainer = surroundedGroupsContainer;

                // Color all surrounded groups
                textureStats.surroundedGroups.forEach(group => {
                    // Get a random color from PLAIN_COLORS
                    const colors = Object.values(PLAIN_COLORS);
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    const plainColor = parseInt(randomColor.replace('#', '0x'));
                    // Color all cells in the group
                    group.forEach(cell => {
                        const newSprite = new PIXI.Sprite(whitebgTexture);
                        newSprite.width = cellSize;
                        newSprite.height = cellSize;
                        newSprite.tint = plainColor;
                        newSprite.x = cell.col * cellSize;
                        newSprite.y = cell.row * cellSize;
                        surroundedGroupsContainer.addChild(newSprite);
                    });
                });

                // Add the container to gridContainer
                gridContainer.addChild(surroundedGroupsContainer);

                previousSurroundedGroupsLength = textureStats.surroundedGroups.length;

                // Add a project card based on percentages
                if (typeof window.addRandomProject === 'function') {
                    window.addRandomProject(
                        textureStats.topPercentage,
                        textureStats.topRightPercentage,
                        textureStats.bottomRightPercentage,
                        textureStats.bottomPercentage,
                        textureStats.bottomLeftPercentage,
                        textureStats.topLeftPercentage
                    );
                }

                // Spawn a lizard from the enclosure nearest to what was just painted.
                // surroundedGroups is rebuilt from scratch each frame in scan order,
                // so we can't rely on array index — find the group closest to the drag.
                const dragCenterX = (startX + endX) / 2;
                const dragCenterY = (startY + endY) / 2;

                let nearestGroup = null;
                let nearestDist = Infinity;
                textureStats.surroundedGroups.forEach(group => {
                    // Group centroid in pixel space
                    let cx = 0, cy = 0;
                    group.forEach(c => { cx += c.col; cy += c.row; });
                    cx = (cx / group.length) * cellSize + cellSize / 2;
                    cy = (cy / group.length) * cellSize + cellSize / 2;
                    const dist = (cx - dragCenterX) ** 2 + (cy - dragCenterY) ** 2;
                    if (dist < nearestDist) { nearestDist = dist; nearestGroup = group; }
                });

                if (nearestGroup) {
                    const cell = nearestGroup[Math.floor(Math.random() * nearestGroup.length)];
                    const spawnX = cell.col * cellSize + cellSize / 2;
                    const spawnY = cell.row * cellSize + cellSize / 2;
                    setSpawnPoint(spawnX, spawnY);
                    spawnLizard(spawnX, spawnY, nearestGroup.length);
                }

                // Notify tutorial that an enclosed space was created
                tutorialSurroundDone();

                gsap.to(leaves, { alpha: 1, duration: 5 });
                gsap.to(frog, { alpha: 1, duration: 5 });
                gsap.to(dragonfly, { alpha: 1, duration: 5 });

                // Wait for 5 seconds before fading out
                setTimeout(() => {
                    gsap.to(leaves, { alpha: 0, duration: 5 }); // Fade out
                    gsap.to(frog, { alpha: 0, duration: 5 });
                    gsap.to(dragonfly, { alpha: 0, duration: 5 });
                }, 5000);
            }

        });

        // Mouse out event
        gridContainer.on('pointerupoutside', () => {
            isDragging = false;
        });

        // Add grid container to image container
        imageContainer.addChild(gridContainer);

        // ===== Category Picker =====
        // A row of small circular buttons that select which category you are
        // drawing with. Replaces the old "drag direction decides the category"
        // mechanic — now the direction of the drag no longer matters.
        // Order matches Config.js (TextureArray / projectType / DIRECTION_COLORS).
        const categoryOptions = [
            { dir: DragDirection.Top,         label: projectType[0], color: parseInt(DIRECTION_COLORS.Top.replace('#', '0x')) },
            { dir: DragDirection.TopRight,    label: projectType[1], color: parseInt(DIRECTION_COLORS.TopRight.replace('#', '0x')) },
            { dir: DragDirection.BottomRight, label: projectType[2], color: parseInt(DIRECTION_COLORS.BottomRight.replace('#', '0x')) },
            { dir: DragDirection.Bottom,      label: projectType[3], color: parseInt(DIRECTION_COLORS.Bottom.replace('#', '0x')) },
            { dir: DragDirection.BottomLeft,  label: projectType[4], color: parseInt(DIRECTION_COLORS.BottomLeft.replace('#', '0x')) },
            { dir: DragDirection.TopLeft,     label: projectType[5], color: parseInt(DIRECTION_COLORS.TopLeft.replace('#', '0x')) },
        ];

        const pickerRadius = 15;
        const pickerSpacing = 48;
        const pickerCount = categoryOptions.length;
        const pickerInnerWidth = (pickerCount - 1) * pickerSpacing;
        const pickerPadX = 30;
        const pickerPadY = 15;
        const pickerBgWidth = pickerInnerWidth + pickerRadius * 2 + pickerPadX * 2;
        const pickerBgHeight = pickerRadius * 2 + pickerPadY * 2;

        const categoryPicker = new PIXI.Container();
        // Centred within the bottom control bar (the bar provides the pill background).
        categoryPicker.x = barW / 2;
        categoryPicker.y = BAR_H / 2;

        // Tooltip label shown above the row on hover / for the active category.
        const pickerTooltip = new PIXI.Text('', {
            fontFamily: 'IBM Plex Mono', fontSize: 14, fill: 0x4a4a4a, align: 'center'
        });
        pickerTooltip.anchor.set(0.5, 1);
        pickerTooltip.y = -pickerBgHeight / 2 - 8;
        categoryPicker.addChild(pickerTooltip);

        const pickerButtons = [];

        function setSelectedCategory(index) {
            selectedCategory = categoryOptions[index].dir;
            pickerTooltip.text = categoryOptions[index].label;
            pickerButtons.forEach((btn, i) => {
                const active = i === index;
                btn.ring.visible = active;
                gsap.to(btn.scale, { x: active ? 1.18 : 1, y: active ? 1.18 : 1, duration: 0.18 });
            });
        }

        const firstX = -pickerInnerWidth / 2;
        categoryOptions.forEach((opt, i) => {
            const btn = new PIXI.Container();
            btn.x = firstX + i * pickerSpacing;
            btn.eventMode = 'static';
            btn.cursor = 'pointer';
            btn.hitArea = new PIXI.Circle(0, 0, pickerRadius + 5);

            // Selection ring (only visible for the active category).
            const ring = new PIXI.Graphics();
            ring.lineStyle(3, 0x2b2b2b, 1);
            ring.drawCircle(0, 0, pickerRadius + 4);
            ring.visible = false;
            btn.addChild(ring);
            btn.ring = ring;

            // Colour dot.
            const dot = new PIXI.Graphics();
            dot.lineStyle(1, 0xffffff, 1);
            dot.beginFill(opt.color);
            dot.drawCircle(0, 0, pickerRadius);
            dot.endFill();
            btn.addChild(dot);

            btn.on('pointertap', () => setSelectedCategory(i));
            btn.on('pointerover', () => { pickerTooltip.text = opt.label; });
            btn.on('pointerout', () => {
                const sel = categoryOptions.findIndex(o => o.dir === selectedCategory);
                pickerTooltip.text = sel >= 0 ? categoryOptions[sel].label : '';
            });

            categoryPicker.addChild(btn);
            pickerButtons.push(btn);
        });

        // ===== Bottom control bar (revealed on hover) =====
        const controlBar = new PIXI.Container();
        controlBar.x = barX;
        controlBar.y = barY;
        controlBar.visible = false;
        controlBar.alpha = 0;

        const controlBarBg = new PIXI.Graphics();
        controlBarBg.beginFill(0xf2f2f2);
        controlBarBg.drawRoundedRect(0, 0, barW, BAR_H, BAR_H / 2);
        controlBarBg.endFill();
        controlBar.addChild(controlBarBg);
        controlBar.addChild(restartButton);
        controlBar.addChild(categoryPicker);

        imageContainer.addChild(controlBar);

        // Reveal the bar only while the pointer is over the play area, auto-hide otherwise.
        imageContainer.hitArea = new PIXI.Rectangle(0, 0, interactiveRect.width, interactiveRect.height);
        const showControlBar = () => {
            gsap.killTweensOf(controlBar);
            controlBar.visible = true;
            gsap.to(controlBar, { alpha: 1, duration: 0.2, ease: 'power2.out' });
        };
        const hideControlBar = () => {
            gsap.killTweensOf(controlBar);
            gsap.to(controlBar, {
                alpha: 0, duration: 0.35, ease: 'power2.out',
                onComplete: () => { controlBar.visible = false; }
            });
        };
        imageContainer.on('pointerenter', showControlBar);
        imageContainer.on('pointerleave', hideControlBar);

        // Ensure layering is predictable across the bottom layout bar / text box.
        app.stage.sortableChildren = true;

        // Default to the first category.
        setSelectedCategory(0);

        // Add the container to the stage
        app.stage.addChild(imageContainer);

    } catch (error) {
        console.error('Error initializing image section:', error);
    }
}

function getDragDirection(startX, startY, endX, endY) {
    // Calculate the angle of the drag vector
    const dx = endX - startX;
    const dy = endY - startY;
    
    // Calculate angle in degrees (0-360)
    // atan2 returns angle in radians from -π to π
    // We convert to degrees and normalize to 0-360
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle < 0) angle += 360;
    
    // Map angle to hexagonal directions (60-degree segments)
    // Each direction covers 60 degrees:
    // BottomRight: 330-30 (or -30 to 30 normalized)
    // Bottom: 30-90
    // BottomLeft: 90-150
    // TopLeft: 150-210
    // Top: 210-270
    // TopRight: 270-330
    
    if (angle >= 330 || angle < 30) {
        return DragDirection.BottomRight;  // Right (0°)
    } else if (angle >= 30 && angle < 90) {
        return DragDirection.Bottom;       // Down-Right (60°)
    } else if (angle >= 90 && angle < 150) {
        return DragDirection.BottomLeft;   // Down-Left (120°)
    } else if (angle >= 150 && angle < 210) {
        return DragDirection.TopLeft;      // Left (180°)
    } else if (angle >= 210 && angle < 270) {
        return DragDirection.Top;          // Up-Left (240°)
    } else { // 270-330
        return DragDirection.TopRight;     // Up-Right (300°)
    }
}

export { initImageSection };