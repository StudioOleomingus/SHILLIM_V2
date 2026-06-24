import { app } from './Config.js';
import { whiteCircleBg } from './Resources.js';
import { slideInFromRight, slideOutToRight } from './Transitions.js';

// Offset used for the detail-window cascade (matches the panel feel)
const DETAIL_SLIDE_OFFSET = 180;

// Track currently open detail window
let currentOpenDetailWindow = null;

// Circular icon button matching the project-card buttons outside:
// grey circle, white icon, darker-grey on hover.
function makeCircleButton(kind) {
    const btn = new PIXI.Container();
    const r = 18;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xd2d2d2);
    bg.drawCircle(0, 0, r);
    bg.endFill();
    btn.addChild(bg);

    if (kind === 'arrow') {
        const arrow = new PIXI.Graphics();
        arrow.beginFill(0xFFFFFF);
        const s = 16;
        arrow.moveTo(-s * 0.35 + 2, -s * 0.5);
        arrow.lineTo(s * 0.55 + 2, 0);
        arrow.lineTo(-s * 0.35 + 2, s * 0.5);
        arrow.closePath();
        arrow.endFill();
        btn.addChild(arrow);
    } else {
        const xSym = new PIXI.Text('×', { fontFamily: 'Arial', fontSize: 22, fill: 0xFFFFFF });
        xSym.anchor.set(0.5);
        xSym.y = -1;
        btn.addChild(xSym);
    }

    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointerover', () => { bg.tint = 0xb0b0b0; });
    btn.on('pointerout', () => { bg.tint = 0xFFFFFF; });
    return btn;
}

function createDetailWindow(artistDetails, details, link, cardBackground, x, y) {
    const detailContainer = new PIXI.Container();
    detailContainer.x = x;
    detailContainer.y = y;

    // Tall card that runs down to the bottom of the play area.
    const detailWidth = 340;
    const detailHeight = 880;
    const padding = 18;
    const headerH = 56;          // top row holding the open + close buttons
    const boxRadius = 14;
    const contentTop = headerH;
    const contentWidth = detailWidth - padding * 2;
    const contentHeightVisible = detailHeight - contentTop - padding;

    // Light-grey card background.
    const background = new PIXI.Graphics();
    background.beginFill(0xECECEC);
    background.drawRoundedRect(0, 0, detailWidth, detailHeight, 18);
    background.endFill();
    detailContainer.addChild(background);

    detailContainer.hitArea = new PIXI.Rectangle(0, 0, detailWidth, detailHeight);
    detailContainer.eventMode = 'static';
    detailContainer.cursor = 'default';

    // White box holding a titled block of text, sized to its content.
    function buildInfoBox(titleStr, bodyStr) {
        const box = new PIXI.Container();
        const innerPad = 16;
        const innerWidth = contentWidth - innerPad * 2;

        const title = new PIXI.Text(titleStr, {
            fontFamily: 'Georgia', fontSize: 20, fontStyle: 'italic',
            fill: 0x808080, wordWrap: true, wordWrapWidth: innerWidth
        });
        title.x = innerPad;
        title.y = innerPad;

        const body = new PIXI.Text(bodyStr, {
            fontFamily: 'Hind Madurai', fontSize: 18, fill: 0x444444,
            wordWrap: true, wordWrapWidth: innerWidth, lineHeight: 26
        });
        body.x = innerPad;
        body.y = title.y + title.height + 10;

        const boxH = body.y + body.height + innerPad;

        const bg = new PIXI.Graphics();
        bg.beginFill(0xFFFFFF);
        bg.drawRoundedRect(0, 0, contentWidth, boxH, boxRadius);
        bg.endFill();

        box.addChild(bg);
        box.addChild(title);
        box.addChild(body);
        box.boxHeight = boxH;
        return box;
    }

    // Scrollable content: two white boxes on the grey card.
    const scrollContainer = new PIXI.Container();
    scrollContainer.x = padding;
    scrollContainer.y = contentTop;

    let cy = 0;
    if (artistDetails) {
        const artistBox = buildInfoBox('Artist Details', artistDetails);
        artistBox.y = cy;
        scrollContainer.addChild(artistBox);
        cy += artistBox.boxHeight + 14;
    }
    const projectBox = buildInfoBox('Project Details', details);
    projectBox.y = cy;
    scrollContainer.addChild(projectBox);
    cy += projectBox.boxHeight;
    const totalContentHeight = cy;

    const scrollMask = new PIXI.Graphics();
    scrollMask.beginFill(0xFFFFFF);
    scrollMask.drawRect(padding, contentTop, contentWidth, contentHeightVisible);
    scrollMask.endFill();
    detailContainer.addChild(scrollMask);
    scrollContainer.mask = scrollMask;
    detailContainer.addChild(scrollContainer);

    // Wheel scrolling within the card (no visible scrollbar).
    if (totalContentHeight > contentHeightVisible) {
        let scrollY = 0;
        const maxScroll = totalContentHeight - contentHeightVisible;
        detailContainer.on('wheel', (event) => {
            if (event.preventDefault) event.preventDefault();
            scrollY = Math.max(0, Math.min(maxScroll, scrollY + event.deltaY * 0.6));
            scrollContainer.y = contentTop - scrollY;
        });
    }

    // Close button (top-right).
    const closeButton = makeCircleButton('close');
    closeButton.x = detailWidth - padding - 18;
    closeButton.y = padding + 18;
    closeButton.on('pointertap', () => {
        slideOutToRight(detailContainer, { offset: DETAIL_SLIDE_OFFSET });
        cardBackground.tint = 0xFFFFFF;
        if (currentOpenDetailWindow === detailContainer) {
            currentOpenDetailWindow = null;
        }
    });

    // Open-project button — moved to the top, beside the close button.
    const openButton = makeCircleButton('arrow');
    openButton.x = closeButton.x - 44;
    openButton.y = padding + 18;
    openButton.on('pointertap', () => {
        if (link) {
            window.open(link, '_blank');
        }
    });

    detailContainer.addChild(closeButton);
    detailContainer.addChild(openButton);

    detailContainer.visible = false;

    // References used by the card toggle (scroll reset on open).
    detailContainer.scrollContainer = scrollContainer;
    detailContainer.topPadding = contentTop;

    return detailContainer;
}

export function createProjectCard(title, author, date, link, details, artistDetails = '', x = 0, y = 0) {
    const cardContainer = new PIXI.Container();
    cardContainer.x = x;
    cardContainer.y = y;

    // Card dimensions
    const cardWidth = 280;
    let cardHeight = 100;
    const padding = 15;
    const buttonSize = 48;
    const buttonPadding = padding;

    // Add text elements first to calculate total height
    // Title text
    const titleText = new PIXI.Text(title, {
        fontFamily: 'Georgia',
        fontSize: 22,
        fontStyle: 'italic',
        fill: 0x000000,
        wordWrap: true,
        wordWrapWidth: cardWidth - (padding * 2)
    });
    titleText.x = padding;
    titleText.y = padding;

    // Author text
    const authorText = new PIXI.Text(author, {
        fontFamily: 'Hind Madurai',
        fontSize: 16,
        fill: 0x808080,
        wordWrap: true,
        wordWrapWidth: cardWidth - (padding * 2)
    });
    authorText.x = padding;
    authorText.y = titleText.y + titleText.height + 8;

    // Date text
    const dateText = new PIXI.Text(date, {
        fontFamily: 'Hind Madurai',
        fontSize: 16,
        fill: 0x808080,
        wordWrap: true,
        wordWrapWidth: cardWidth - (padding * 2)
    });
    dateText.x = padding;
    dateText.y = authorText.y + authorText.height + 8;

    // Calculate required height — add room for the button row below text
    const contentHeight = dateText.y + dateText.height + buttonSize + buttonPadding + 10;
    cardHeight = Math.max(cardHeight, contentHeight);

    // Create background with rounded corners (no outline)
    const background = new PIXI.Graphics();
    background.beginFill(0xFFFFFF);
    background.drawRoundedRect(0, 0, cardWidth, cardHeight, 26);
    background.endFill();
    cardContainer.addChild(background);

    // Now add the text elements to the container
    cardContainer.addChild(titleText);
    cardContainer.addChild(authorText);
    cardContainer.addChild(dateText);

    cardContainer.eventMode = 'static';
    cardContainer.cursor = 'pointer';

    // Create button container in bottom right
    const buttonContainer = new PIXI.Container();
    buttonContainer.x = cardWidth - buttonSize - padding;
    buttonContainer.y = cardHeight - buttonSize - padding;
    
    // Button background (circle)
    const buttonBg = new PIXI.Graphics();
    buttonBg.beginFill(0xd2d2d2);
    buttonBg.drawCircle(buttonSize/2, buttonSize/2, buttonSize/2);
    buttonBg.endFill();
    buttonContainer.addChild(buttonBg);

    // Triangle arrow inside button
    const arrow = new PIXI.Graphics();
    arrow.beginFill(0xFFFFFF);
    const arrowSize = 16;
    const cx = buttonSize / 2 + 2; // slight right offset to visually center the triangle
    const cy = buttonSize / 2;
    arrow.moveTo(cx - arrowSize * 0.4, cy - arrowSize * 0.5);
    arrow.lineTo(cx + arrowSize * 0.5, cy);
    arrow.lineTo(cx - arrowSize * 0.4, cy + arrowSize * 0.5);
    arrow.closePath();
    arrow.endFill();
    buttonContainer.addChild(arrow);

    // Make button interactive
    buttonContainer.eventMode = 'static';
    buttonContainer.cursor = 'pointer';

    // Button hover effects
    buttonContainer.on('pointerover', () => {
        buttonBg.tint = 0xb0b0b0;
    });

    buttonContainer.on('pointerout', () => {
        buttonBg.tint = 0xFFFFFF;
    });

    // Create a separate container for the detail window to avoid clipping
    const detailContainer = new PIXI.Container();
    app.stage.addChild(detailContainer);

    // Create detail window — anchored near the top so the tall card spans the play area
    const detailWindow = createDetailWindow(artistDetails, details, link, background, cardContainer.x + cardWidth + 20, 80);
    detailContainer.addChild(detailWindow);

    // Click handler to toggle detail window
    buttonContainer.on('pointertap', () => {
        // Close any previously open detail window (cascade it back out)
        if (currentOpenDetailWindow && currentOpenDetailWindow !== detailWindow) {
            slideOutToRight(currentOpenDetailWindow, { offset: DETAIL_SLIDE_OFFSET });
            // Reset the previous card background
            if (currentOpenDetailWindow.cardBackground) {
                currentOpenDetailWindow.cardBackground.tint = 0xFFFFFF;
            }
        }

        // Treat as "open" if it's not currently the active/visible window
        const isOpening = !detailWindow.visible;

        if (isOpening) {
            // Reset scroll position when opening
            detailWindow.scrollContainer.y = detailWindow.topPadding;
            if (detailWindow.scrollbarThumb) {
                detailWindow.scrollbarThumb.y = detailWindow.topPadding;
            }
            currentOpenDetailWindow = detailWindow;
            detailWindow.cardBackground = background;
            background.tint = 0xE6F3FF; // Light blue
            // Cascade the detail window in from the right
            slideInFromRight(detailWindow, { offset: DETAIL_SLIDE_OFFSET });
        } else {
            slideOutToRight(detailWindow, { offset: DETAIL_SLIDE_OFFSET });
            if (currentOpenDetailWindow === detailWindow) {
                currentOpenDetailWindow = null;
            }
            background.tint = 0xFFFFFF; // White
        }
    });

    // Store reference to detail container for cleanup
    cardContainer.detailContainer = detailContainer;

    cardContainer.addChild(buttonContainer);

    return cardContainer;
}
