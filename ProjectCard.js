import { app, interactiveRect } from './Config.js';
import { whiteCircleBg } from './Resources.js';
import { slideInFromLeft, slideOutToLeft } from './Transitions.js';
import { initLadybugAnimator, spawnLadybug } from './LadybugAnimator.js';

// Offset used for the detail-window cascade
const DETAIL_SLIDE_OFFSET = 450;

// Track currently open detail window
let currentOpenDetailWindow = null;
let currentLadybug = null;
let ladybugReady = false;
let spawnTimeout = null;

// Lazy-init ladybug frames on first card open
async function ensureLadybug() {
    if (ladybugReady) return;
    await initLadybugAnimator();
    ladybugReady = true;
}

// Close the open detail window when the user clicks anywhere outside of it
let outsideCloseInstalled = false;
function installOutsideClose() {
    if (outsideCloseInstalled) return;
    outsideCloseInstalled = true;

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

        if (within(win) || within(win.ownerCard)) return;

        // Reparent ladybug before the card slides away
        if (spawnTimeout) { clearTimeout(spawnTimeout); spawnTimeout = null; }
        if (currentLadybug) { currentLadybug.drop(); currentLadybug = null; }

        slideOutToLeft(win, { offset: DETAIL_SLIDE_OFFSET });
        if (win.cardBackground) win.cardBackground.tint = 0xFFFFFF;

        currentOpenDetailWindow = null;
    });
}

// Circular icon button
function makeCircleButton(kind) {
    const btn = new PIXI.Container();
    const r = 24;
    const bg = new PIXI.Graphics();
    bg.beginFill(0xd2d2d2);
    bg.drawCircle(0, 0, r);
    bg.endFill();
    btn.addChild(bg);

    if (kind === 'arrow') {
        const plus = new PIXI.Graphics();
        plus.beginFill(0xFFFFFF);
        const span = 18;
        const arm = 4.5;
        plus.drawRect(-arm / 2, -span / 2, arm, span);
        plus.drawRect(-span / 2, -arm / 2, span, arm);
        plus.endFill();
        btn.addChild(plus);
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

    const detailWidth = 408;
    const detailHeight = app.screen.height - y * 2;
    const padding = 18;
    const headerH = 84;
    const boxRadius = 14;
    const contentTop = headerH;
    const contentWidth = detailWidth - padding * 2;
    const contentHeightVisible = detailHeight - contentTop - padding;

    // Rounded on all four corners so the panel reads as one complete element.
    // Radius matches the project cards (26) for a consistent look.
    const r = 26;
    const background = new PIXI.Graphics();
    background.beginFill(0xF5F5F5);
    background.drawRoundedRect(0, 0, detailWidth, detailHeight, r);
    background.endFill();
    detailContainer.addChild(background);

    detailContainer.hitArea = new PIXI.Rectangle(0, 0, detailWidth, detailHeight);
    detailContainer.eventMode = 'static';
    detailContainer.cursor = 'default';

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

    if (totalContentHeight > contentHeightVisible) {
        let scrollY = 0;
        const maxScroll = totalContentHeight - contentHeightVisible;
        detailContainer.on('wheel', (event) => {
            if (event.preventDefault) event.preventDefault();
            scrollY = Math.max(0, Math.min(maxScroll, scrollY + event.deltaY * 0.6));
            scrollContainer.y = contentTop - scrollY;
        });
    }

    const openButton = makeCircleButton('arrow');
    openButton.x = detailWidth - padding - 24;
    openButton.y = padding + 24;
    openButton.on('pointertap', () => {
        if (link) window.open(link, '_blank');
    });
    detailContainer.addChild(openButton);

    detailContainer.visible = false;
    detailContainer.scrollContainer = scrollContainer;
    detailContainer.topPadding = contentTop;

    return detailContainer;
}

export function createProjectCard(title, author, date, link, details, artistDetails = '', x = 0, y = 0) {
    const cardContainer = new PIXI.Container();
    cardContainer.x = x;
    cardContainer.y = y;

    const cardWidth = 300;
    let cardHeight = 100;
    const padding = 15;

    const titleText = new PIXI.Text(title, {
        fontFamily: 'Gelasio', fontSize: 22, fontStyle: 'italic', fill: 0x000000,
        wordWrap: true, wordWrapWidth: cardWidth - (padding * 2)
    });
    titleText.x = padding;
    titleText.y = padding;

    const authorText = new PIXI.Text(author, {
        fontFamily: 'Hind Madurai', fontSize: 16, fill: 0x808080,
        wordWrap: true, wordWrapWidth: cardWidth - (padding * 2)
    });
    authorText.x = padding;
    authorText.y = titleText.y + titleText.height + 8;

    const dateText = new PIXI.Text(date, {
        fontFamily: 'Hind Madurai', fontSize: 16, fill: 0x808080,
        wordWrap: true, wordWrapWidth: cardWidth - (padding * 2)
    });
    dateText.x = padding;
    dateText.y = authorText.y + authorText.height + 8;

    const contentHeight = dateText.y + dateText.height + padding;
    cardHeight = Math.max(cardHeight, contentHeight);

    const background = new PIXI.Graphics();
    background.beginFill(0xFFFFFF);
    background.drawRoundedRect(0, 0, cardWidth, cardHeight, 26);
    background.endFill();
    cardContainer.addChild(background);

    cardContainer.addChild(titleText);
    cardContainer.addChild(authorText);
    cardContainer.addChild(dateText);

    cardContainer.eventMode = 'static';
    cardContainer.cursor = 'pointer';
    cardContainer.hitArea = new PIXI.Rectangle(0, 0, cardWidth, cardHeight);

    const detailContainer = new PIXI.Container();
    app.stage.sortableChildren = true;
    app.stage.addChild(detailContainer);

    // Mask the detail container to the game card edge — drawer hides behind the card boundary
    const PLAY_GAP = 14;
    const cardEdge = interactiveRect.x + PLAY_GAP;
    const drawerMask = new PIXI.Graphics();
    drawerMask.beginFill(0xFFFFFF);
    drawerMask.drawRoundedRect(cardEdge, PLAY_GAP, app.screen.width - cardEdge - PLAY_GAP, app.screen.height - PLAY_GAP * 2, 28);
    drawerMask.endFill();
    app.stage.addChild(drawerMask);
    detailContainer.mask = drawerMask;

    const detailWindow = createDetailWindow(artistDetails, details, link, background, cardContainer.x + cardWidth + 60, 80);
    detailContainer.addChild(detailWindow);

    const TINT_OPEN = 0xE6F3FF;
    const TINT_HOVER = 0xEFEFEF;

    async function toggleDetail() {
        // Close any previously open detail window
        if (currentOpenDetailWindow && currentOpenDetailWindow !== detailWindow) {
            if (spawnTimeout) { clearTimeout(spawnTimeout); spawnTimeout = null; }
            if (currentLadybug) { currentLadybug.drop(); currentLadybug = null; }
            slideOutToLeft(currentOpenDetailWindow, { offset: DETAIL_SLIDE_OFFSET });
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
            slideInFromLeft(detailWindow, { offset: DETAIL_SLIDE_OFFSET });

            // Spawn ladybug after 1 second delay
            await ensureLadybug();
            const targetX = 200;
            if (spawnTimeout) clearTimeout(spawnTimeout);
            spawnTimeout = setTimeout(() => {
                spawnTimeout = null;
                currentLadybug = spawnLadybug(detailWindow, targetX);
            }, 1000);
        } else {
            // Cancel pending spawn and reparent ladybug before the card slides away
            if (spawnTimeout) { clearTimeout(spawnTimeout); spawnTimeout = null; }
            if (currentLadybug) { currentLadybug.drop(); currentLadybug = null; }

            slideOutToLeft(detailWindow, { offset: DETAIL_SLIDE_OFFSET });
            if (currentOpenDetailWindow === detailWindow) {
                currentOpenDetailWindow = null;
            }
            background.tint = 0xFFFFFF;
        }
    }

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

    cardContainer.on('pointerover', () => {
        if (!detailWindow.visible) background.tint = TINT_HOVER;
    });
    cardContainer.on('pointerout', () => {
        if (!detailWindow.visible) background.tint = 0xFFFFFF;
    });

    cardContainer.detailContainer = detailContainer;

    installOutsideClose();

    return cardContainer;
}