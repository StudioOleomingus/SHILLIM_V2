const stageWidth = 1650;
const stageHeight = 1000;

// Create PIXI application with optimized settings
const app = new PIXI.Application({
    width: stageWidth,
    height: stageHeight,
    backgroundColor: 0xECECEC,
    antialias: true,
    resolution: window.devicePixelRatio || 1,
    powerPreference: 'high-performance',
    clearBeforeRender: true,
    hello: true // Enable WebGL2 if available
});
const GRID_OFFSET_X = 310;

const stageSize = 1240;
const cellSize = 20;
const numberOfRows = 50;
const numberOfColumns = 62;

// Cache color values
const COLORS = {
    CELL_DEFAULT: '#f0f0f0',
    CELL_SELECTED: '#4444ff',
    SELECTION_FILL: 'rgba(0, 0, 255, 0.2)',
    SELECTION_STROKE: 'black',
    CELL_STROKE: 'black',
    CELL_SHADOW: 'black',
    TEXT_COLOR: 'black',
    SCROLLBAR_BG: '#dddddd',
    SCROLLBAR_THUMB: '#999999'
};

// Direction colors - Hexagonal (6 directions)
const DIRECTION_COLORS = {
    Top: '#e16d6d',           // Red - ART
    TopRight: '#77e1b1',      // Green - COMMUNITY
    BottomRight: '#6092e2',   // Blue - ECOLOGY
    Bottom: '#76dd89',        // Orange - RESEARCH
    BottomLeft: '#47729a',    // Purple - HEALTH
    TopLeft: '#4b4b4b'        // Deep Orange - EDUCATION
};

// Encloser colors - Hexagonal (6 directions)
const PLAIN_COLORS = {
    Top: '#d2d0cb',           // ART
    TopRight: '#d2cdcd',      // COMMUNITY
    BottomRight: '#dcd6ca',   // ECOLOGY
    Bottom: '#c5d8e1',        // RESEARCH
    BottomLeft: '#d5e8d5',    // HEALTH
    TopLeft: '#e8dfd6'        // EDUCATION
};

// Direction enum - Hexagonal (6 directions)
// Directions are determined by angle: Top (270°±30°), TopRight (330°±30°), etc.
const DragDirection = {
    Top: 'Top',                   // 240° to 300° (straight up)
    TopRight: 'TopRight',         // 300° to 360° (up and right)
    BottomRight: 'BottomRight',   // 0° to 60° (down and right)
    Bottom: 'Bottom',             // 60° to 120° (straight down)
    BottomLeft: 'BottomLeft',     // 120° to 180° (down and left)
    TopLeft: 'TopLeft'            // 180° to 240° (up and left)
};

// Define the folder paths - 6 hexagonal categories
const folderPaths = [
    'assets/GAME-TEXTURES/illustration1',  // ART - Top
    'assets/GAME-TEXTURES/illustration2',  // COMMUNITY - TopRight
    'assets/GAME-TEXTURES/illustration3',  // ECOLOGY - BottomRight
    'assets/GAME-TEXTURES/illustration4',  // RESEARCH - Bottom
    'assets/GAME-TEXTURES/illustration5',  // HEALTH - BottomLeft
    'assets/GAME-TEXTURES/illustration6'   // EDUCATION - TopLeft
];

const projectType = [
    'ART',        // Top
    'COMMUNITY',  // TopRight
    'ECOLOGY',    // BottomRight
    'RESEARCH',   // Bottom
    'HEALTH',     // BottomLeft
    'EDUCATION'   // TopLeft
];

const projectDescriptionTexts = [
    'Description 1',  // ART
    'Description 2',  // COMMUNITY
    'Description 3',  // ECOLOGY
    'Description 4',  // RESEARCH
    'Description 5',  // HEALTH
    'Description 6'   // EDUCATION
];

const TextureArray = folderPaths.map(() => Array.from(Array(numberOfRows), () => Array(numberOfColumns)));

// Direction images
var TileImageDirection;

var stage, layer, leftLayer, rightLayer, selectionLayer;

// The interactive section sits to the right of the 310px sidebar zone. Its
// width grew from 1240 to 1340 when the design ratio changed from 1550:1000 to
// 1650:1000 (310 + 1340 = 1650). The painting grid itself stays a fixed 1240px
// square (see numberOfColumns * cellSize) and is centred inside this wider
// card, so the extra width shows as even white padding rather than stretching
// the illustration tiles.
let interactiveRect = {
    x: 310,
    y: 0,
    width: 1340,
    height: 1000,
};

class GridCell {
    constructor(row, col, sprite) {
        this.row = row;
        this.col = col;
        this.sprite = sprite; // Will store the PIXI.Sprite object
    }

    getPosition() {
        return { row: this.row, col: this.col };
    }

    setSprite(newSprite) {
        if (this.sprite) {
            this.sprite.destroy();
        }
        this.sprite = newSprite;
    }

    destroy() {
        if (this.sprite) {
            this.sprite.destroy();
        }
    }
}

let gridCells = [];
let projects = [];

// Function to load projects from JSON
async function loadProjects() {
    try {
        const response = await fetch('data/projects.json');
        if (!response.ok) throw new Error('Failed to load projects');
        const data = await response.json();
        projects = data.projects;
        return data.projects;
    } catch (error) {
        console.error('Error loading projects:', error);
        return [];
    }
}

// Initialize projects
(async () => {
    projects = await loadProjects();
})();

export { app, folderPaths, stageWidth, stageHeight, GRID_OFFSET_X, stageSize, cellSize, numberOfRows, numberOfColumns, COLORS, DIRECTION_COLORS, PLAIN_COLORS, DragDirection, TileImageDirection, TextureArray, GridCell, gridCells, projects, interactiveRect, projectType, projectDescriptionTexts };