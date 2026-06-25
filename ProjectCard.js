import { app } from './Config.js';
import { whiteCircleBg } from './Resources.js';
import { slideInFromRight, slideOutToRight } from './Transitions.js';

// Offset used for the detail-window cascade (matches the panel feel)
const DETAIL_SLIDE_OFFSET = 180;

// Track currently open detail window
let currentOpenDetailWindow = null;

// Close the open detail window when the user clicks anywhere outside of it
// (and outside the card that owns it). Installed once, lazily.
let outsideCloseInstalled = false;
function installOutsideClose() {
    if (outsideCloseInstalled) return;
    outsideCloseInstalled = true;

    // Ensure the stage itself reports taps on empty regions (not just on
    // interactive children), so clicks anywhere outside the box register.
    app.stage.eventMode = 'static';
    app.stage.hitArea = new PIXI.Rectangle(0, 0, app.screen.width, app.screen.height);

    app.stage.on('pointertap', (event) => {
        const win = currentOpenDetailWindow;
        if (!win || !win.visible) return;

        const p = event.global;
        const within = (node) => {
            if (!node) return false;
            const b = node.getBounds();
            return p.x >= b.x && p.x <= b.x + b.width && p.y >= b.y && p.y <= b.y + b.height;
        };

        // Ignore clicks on the detail window itself or on its owning card
        // (the card handles its own open/close toggle).
        if (within(win) || within(win.ownerCard)) return;

        slideOutToRight(win, { offset: DETAIL_SLIDE_OFFSET });
        if (win.cardBackground) win.cardBackground.tint = 0xFFFFFF;
        currentOpenDetailWindow = null;
    });
}

// Circular icon button matching the project-card buttons outside:
// grey circle, white icon, darker-grey on hover. Radius 24 == the 48px
// card buttons outside the detail window.
function makeCircleButton(kind) {
    const btn = new PIXI.Container();
    const r = 24;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xd2d2d2);
    bg.drawCircle(0, 0, r);
    bg.endFill();
    btn.addChild(bg);

    if (kind === 'arrow') {
        const arrow = new PIXI.Graphics();
        arrow.beginFill(0xFFFFFF);
        const s = 16;
        arrow.moveTo(-s * 0.4 + 2, -s * 0.5);
        arrow.lineTo(s * 0.5 + 2, 0);
        arrow.lineTo(-s * 0.4 + 2, s * 0.5);
        arrow.closePath();
        arrow.endFill();
        btn.addChild(arrow);
    } else {
        const xSym = new PIXI.Text('×', { fontFamily: 'Hind Madurai', fontSize: 28, fill: 0xFFFFFF });
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

    const detailWidth = 408;     // 20% wider than the original 340
    // Match the gap below the box to the gap above it (the box opens at y).
    const detailHeight = app.screen.height - y * 2;
    const padding = 18;
    const headerH = 84;          // top row holding the open button
    const boxRadius = 14;
    const contentTop = headerH;
    const contentWidth = detailWidth - padding * 2;
    const contentHeightVisible = detailHeight - contentTop - padding;

    // Light-grey card background.
    const background = new PIXI.Graphics();
    background.beginFill(0xF5F5F5);
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
            fontFamily: 'Gelasio', fontSize: 20, fontStyle: 'italic',
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

    // Open-project button (top-right). The box closes by clicking outside it,
    // so no dedicated close button is needed.
    const openButton = makeCircleButton('arrow');
    openButton.x = detailWidth - padding - 24;
    openButton.y = padding + 24;
    openButton.on('pointertap', () => {
        if (link) {
            window.open(link, '_blank');
        }
    });

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
    const cardWidth = 300;
    let cardHeight = 100;
    const padding = 15;

    // Add text elements first to calculate total height
    // Title text
    const titleText = new PIXI.Text(title, {
        fontFamily: 'Gelasio',
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

    // Calculate required height — snug fit around the text (card is fully clickable).
    const contentHeight = dateText.y + dateText.height + padding;
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

    // The whole card is the clickable target.
    cardContainer.eventMode = 'static';
    cardContainer.cursor = 'pointer';
    cardContainer.hitArea = new PIXI.Rectangle(0, 0, cardWidth, cardHeight);

    // Create a separate container for the detail window to avoid clipping
    const detailContainer = new PIXI.Container();
    app.stage.addChild(detailContainer);

    // Create detail window — anchored near the top so the tall card spans the play area
    const detailWindow = createDetailWindow(artistDetails, details, link, background, cardContainer.x + cardWidth + 20, 80);
    detailContainer.addChild(detailWindow);

    // Tints used to signal card state.
    const TINT_OPEN = 0xE6F3FF;   // light blue while its detail window is open
    const TINT_HOVER = 0xEFEFEF;  // subtle grey on hover to signal clickability

    function toggleDetail() {
        // Close any previously open detail window (cascade it back out)
        if (currentOpenDetailWindow && currentOpenDetailWindow !== detailWindow) {
            slideOutToRight(currentOpenDetailWindow, { offset: DETAIL_SLIDE_OFFSET });
            if (currentOpenDetailWindow.cardBackground) {
                currentOpenDetailWindow.cardBackground.tint = 0xFFFFFF;
            }
        }

        const isOpening = !detailWindow.visible;

        if (isOpening) {
            detailWindow.scrollContainer.y = detailWindow.topPadding;
            if (detailWindow.scrollbarThumb) {
                detailWindow.scrollbarThumb.y = detailWindow.topPadding;
            }
            currentOpenDetailWindow = detailWindow;
            detailWindow.cardBackground = background;
            detailWindow.ownerCard = cardContainer;
            background.tint = TINT_OPEN;
            slideInFromRight(detailWindow, { offset: DETAIL_SLIDE_OFFSET });
        } else {
            slideOutToRight(detailWindow, { offset: DETAIL_SLIDE_OFFSET });
            if (currentOpenDetailWindow === detailWindow) {
                currentOpenDetailWindow = null;
            }
            background.tint = 0xFFFFFF;
        }
    }

    // Distinguish a genuine click from a list drag-scroll: only toggle when the
    // pointer hasn't moved far between press and release.
    let downX = 0, downY = 0, moved = false;
    cardContainer.on('pointerdown', (event) => {
        downX = event.global.x;
        downY = event.global.y;
        moved = false;
    });
    cardContainer.on('pointermove', (event) => {
        if (Math.hypot(event.global.x - downX, event.global.y - downY) > 8) moved = true;
    });
    cardContainer.on('pointerup', () => {
        if (!moved) toggleDetail();
    });

    // Hover state — only when this card's detail window isn't already open.
    cardContainer.on('pointerover', () => {
        if (!detailWindow.visible) background.tint = TINT_HOVER;
    });
    cardContainer.on('pointerout', () => {
        if (!detailWindow.visible) background.tint = 0xFFFFFF;
    });

    // Store reference to detail container for cleanup
    cardContainer.detailContainer = detailContainer;

    installOutsideClose();

    return cardContainer;
}
