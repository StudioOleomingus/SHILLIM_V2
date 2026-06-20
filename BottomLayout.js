import { app, stageWidth, projectDescriptionTexts } from './Config.js';

const container = document.getElementById('app-container');

// Total width of the layout
let totalWidth = 1100;

// Create sections with text - 6 hexagonal categories
const sections = [
    { text: 'ART', color: 0xb1c6c9, container: null },           // Light blue-gray - Top
    { text: 'COMMUNITY', color: 0xBCAB99, container: null },     // Beige - TopRight
    { text: 'ECOLOGY', color: 0x97a266, container: null },       // Olive green - BottomRight
    { text: 'RESEARCH', color: 0x445768, container: null },      // Dark gray - Bottom
    { text: 'HEALTH', color: 0x9b6b9e, container: null },        // Purple - BottomLeft
    { text: 'EDUCATION', color: 0xd4915d, container: null }      // Deep Orange - TopLeft
];

// Store the layout container and text elements globally
let layoutContainer = null;
let textBoxContainer = null;
let textElement = null;

function updateTextBox(){
    // Update text box with random description
    if (textBoxContainer && textElement && projectDescriptionTexts.length > 0) {
        const randomIndex = Math.floor(Math.random() * projectDescriptionTexts.length);
        textElement.text = projectDescriptionTexts[randomIndex];
        textBoxContainer.visible = true;
    }
}

// Function to update section sizes based on percentages - 6 hexagonal directions
function updateSectionSizes(p1 = 16.67, p2 = 16.67, p3 = 16.67, p4 = 16.67, p5 = 16.67, p6 = 16.67) {
    if(layoutContainer == null) {
        console.log('Layout container not initialized');
        return;
    }

    
    // Adjust percentages if total exceeds 100%
    let adjustedPercentages = [p1, p2, p3, p4, p5, p6];
    let total = adjustedPercentages.reduce((sum, p) => sum + p, 0);
    
    if (total > 100) {
        // Scale down all percentages proportionally
        const scale = 100 / total;
        adjustedPercentages = adjustedPercentages.map(p => p * scale);
        //console.log('Adjusted percentages to:', adjustedPercentages);
        [p1, p2, p3, p4, p5, p6] = adjustedPercentages;
    }

    layoutContainer.removeChildren();

    // Create background with rounded corners
    const background = new PIXI.Graphics();
    background.beginFill(0xEEEEEE);
    background.drawRoundedRect(0, 0, totalWidth, 50, 20);
    background.endFill();
    layoutContainer.addChild(background);
    
    // Create initial sections
    sections.forEach((section, index) => {
        // Create container for each section
        const sectionContainer = new PIXI.Container();
        section.container = sectionContainer;
        sectionContainer.interactive = false;

        // Create section background
        const sectionBg = new PIXI.Graphics();
        sectionContainer.addChild(sectionBg);
        sectionBg.interactive = false;

        // Add text label
        const textLabel = new PIXI.Text(section.text, {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0xFFFFFF,
            align: 'right'
        });
        textLabel.anchor.set(1, 0.5);
        textLabel.y = 25; // Vertically centered
        textLabel.interactive = false;
        sectionContainer.addChild(textLabel);

        layoutContainer.addChild(sectionContainer);
    });

    //console.log('Updating sections with percentages:', [p1, p2, p3, p4, p5, p6]);

    // Ensure we have the layout container
    if (!layoutContainer) {
        console.error('Layout container not initialized');
        return;
    }

    let currentX = 0;

    sections.forEach((section, index) => {
        const percentage = [p1, p2, p3, p4, p5, p6][index];
        //console.log(`Section ${section.text}: ${percentage}%, container:`, section.container?.visible);
        
        // Show and update section if percentage > 0, hide if 0
        if (section.container) {
            if (percentage <= 0) {
                section.container.visible = false;
                //console.log(`Hiding section ${section.text}`);
            } else {
                section.container.visible = true;
                const width = (percentage / 100) * totalWidth;
                
                // Get text element and check if it fits
                const textLabel = section.container.getChildAt(1); // Text is the second child
                const textWidth = textLabel.width + 10; // Add some padding
                textLabel.visible = textWidth <= width;
                
                //console.log(`Showing section ${section.text} with width ${width}, text width: ${textWidth}`);

                // Update background
                const sectionBg = section.container.getChildAt(0);
                sectionBg.clear();
            
                // Apply rounded corners based on position
                const isFirst = currentX === 0;
                const isLast = index === sections.findLastIndex((_, i) => [p1, p2, p3, p4, p5, p6][i] > 0);
                const radius = 20;

                // Draw main rectangle
                sectionBg.beginFill(section.color);
                sectionBg.drawRect(0, 0, width, 50);
                sectionBg.endFill();

                // Draw rounded corners if needed
                if (isFirst || isLast) {
                    // Create a mask for rounded corners
                    const mask = new PIXI.Graphics();
                    mask.beginFill(0xFFFFFF);

                    if (isFirst && isLast) {
                        // All corners rounded
                        mask.drawRect(radius, 0, width - 2 * radius, 50);
                        mask.drawCircle(radius, radius, radius);
                        mask.drawCircle(radius, 50 - radius, radius);
                        mask.drawCircle(width - radius, radius, radius);
                        mask.drawCircle(width - radius, 50 - radius, radius);
                    } else if (isFirst) {
                        // Left corners rounded
                        mask.drawRect(radius, 0, width - radius, 50);
                        mask.drawCircle(radius, radius, radius);
                        mask.drawCircle(radius, 50 - radius, radius);
                    } else {
                        // Right corners rounded
                        mask.drawRect(0, 0, width - radius, 50);
                        mask.drawCircle(width - radius, radius, radius);
                        mask.drawCircle(width - radius, 50 - radius, radius);
                    }
                    mask.endFill();

                    // Apply the mask
                    sectionBg.mask = mask;
                    sectionBg.addChild(mask);
                }

                // Update position and text
                section.container.x = currentX;
                const text = section.container.getChildAt(1);
                text.x = width - 10; // Right align with 10px padding

                currentX += width;
            }
        }
    });
}

async function initBottomLayout() {
    try {
        // Create a container for the text box with shadow
        textBoxContainer = new PIXI.Container();
        textBoxContainer.x = 390;  // Same x as layoutContainer
        textBoxContainer.y = app.screen.height - 145;  // Position above layoutContainer with padding

        // Create shadow for text box
        let shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.1);
        shadow.drawRoundedRect(4, 4, (container.clientWidth - 390) - 10, 75, 40);
        shadow.endFill();
        textBoxContainer.addChild(shadow);

        // Create text box background
        let textBox = new PIXI.Graphics();
        textBox.lineStyle(1, 0xd2d2d2, 1);
        textBox.beginFill(0xFFFFFF);
        textBox.drawRoundedRect(0, 0, (container.clientWidth - 390) - 10, 75, 40);
        textBox.endFill();
        textBoxContainer.addChild(textBox);

        // Add text to the textbox
        textElement = new PIXI.Text('Welcome to the interactive grid! Drag to create shapes.', {
            fontFamily: 'Arial',
            fontSize: 16,
            fill: 0x808080,
            align: 'center'
        });

        // Center the text vertically and horizontally
        textElement.anchor.set(0.5);
        textElement.x = ((container.clientWidth - 390) - 10) / 2;
        textElement.y = 37;
        
        textBoxContainer.addChild(textElement);

        // Create close button
        const closeButton = new PIXI.Container();
        
        // Close button background
        const closeButtonBg = new PIXI.Graphics();
        closeButtonBg.beginFill(0xf0f0f0);
        closeButtonBg.drawCircle(0, 0, 12);
        closeButtonBg.endFill();
        closeButton.addChild(closeButtonBg);

        // Close button X symbol
        const closeSymbol = new PIXI.Text('×', {
            fontFamily: 'Arial',
            fontSize: 20,
            fill: 0x808080,
            align: 'center'
        });
        closeSymbol.anchor.set(0.5);
        closeButton.addChild(closeSymbol);

        // Position close button
        closeButton.x = (container.clientWidth - 390) - 30;
        closeButton.y = 20;
        closeButton.eventMode = 'static';
        closeButton.cursor = 'pointer';

        // Add hover effect
        closeButton.on('pointerover', () => {
            closeButtonBg.tint = 0xe0e0e0;
        });
        closeButton.on('pointerout', () => {
            closeButtonBg.tint = 0xFFFFFF;
        });

        // Add click handler
        closeButton.on('pointerdown', () => {
            textBoxContainer.visible = false;
        });

        textBoxContainer.visible = false;

        textBoxContainer.addChild(closeButton);

        // Add text box container to stage
        app.stage.addChild(textBoxContainer);

        // Create a container for the bottom layout
        layoutContainer = new PIXI.Container();
        layoutContainer.x = 390;  // Position from left
        layoutContainer.y = app.screen.height - 60;  // Position at bottom
        //layoutContainer.eventMode = 'static';
        // Make the container non-interactable
        layoutContainer.interactive = false;

        totalWidth = (container.clientWidth - 390) - 10; // 10 is padding, // 440 is left margin

        // Initial layout with equal sizes - 6 categories
        updateSectionSizes(0,0,0,0,0,0);

        app.stage.addChild(layoutContainer);

        // Handle window resizing
        function resize() {
            totalWidth = (container.clientWidth - 390) - 10; // 10 is padding

            // Update layout container position
            layoutContainer.y = container.clientHeight - 60;
            
            // Update text box container position and size
            textBoxContainer.y = container.clientHeight - 145;
            
            // Update shadow
            shadow.clear();
            shadow.beginFill(0x000000, 0.1);
            shadow.drawRoundedRect(4, 4, totalWidth, 75, 40);
            shadow.endFill();
            
            // Update text box
            textBox.clear();
            textBox.lineStyle(1, 0xd2d2d2, 1);
            textBox.beginFill(0xFFFFFF);
            textBox.drawRoundedRect(0, 0, totalWidth, 75, 40);
            textBox.endFill();

            // Update text position
            textElement.x = totalWidth / 2;

            // Update close button position
            closeButton.x = totalWidth - 30;
        }

        // Initial resize
        resize();

        // Add window resize listener
        window.addEventListener('resize', resize);

    } catch (error) {
        console.error('Error in initBottomLayout:', error);
    }
}

export { initBottomLayout, updateSectionSizes, updateTextBox };
