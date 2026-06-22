import { app } from './Config.js';

let parentContainer = null;
let lizardFrames = null;
let lastSpawnX = null;
let lastSpawnY = null;

/**
 * Initialise the lizard animator.
 * Loads individual PNG frames from assets/lizard/ folder.
 * Name them sequentially: 0.png, 1.png, 2.png, ...
 *
 * @param {PIXI.Container} container – the interactive grid container
 */
export async function initLizardAnimator(container) {
    parentContainer = container;

    const frameCount = 8; // adjust to match your frame count

    try {
        const frames = [];
        for (let i = 0; i < frameCount; i++) {
            const texture = await PIXI.Assets.load(`assets/lizard/${i}.png`);
            frames.push(texture);
        }
        lizardFrames = frames;
    } catch (err) {
        console.warn('LizardAnimator: could not load frames –', err);
    }
}

/**
 * Update the spawn origin to the newest enclosed space.
 * Called from ImageSection whenever a new enclosure forms.
 *
 * @param {number} x – pixel x in grid-local coords
 * @param {number} y – pixel y in grid-local coords
 */
export function setSpawnPoint(x, y) {
    lastSpawnX = x;
    lastSpawnY = y;
}

/**
 * Spawn a lizard from the most recent enclosure point.
 * It picks a random direction aimed outward toward the nearest edge,
 * travels in a straight line, and is destroyed on exit — no return.
 *
 * @param {number} [x] – override spawn x (defaults to last setSpawnPoint)
 * @param {number} [y] – override spawn y (defaults to last setSpawnPoint)
 */
export function spawnLizard(x, y) {
    if (!lizardFrames || !parentContainer) return;

    // Use explicit coords, then last spawn point, then centre as fallback
    x = x ?? lastSpawnX ?? parentContainer.width / 2;
    y = y ?? lastSpawnY ?? parentContainer.height / 2;

    const lizard = new PIXI.AnimatedSprite(lizardFrames);
    lizard.animationSpeed = 0.18;
    lizard.anchor.set(0.5);
    lizard.scale.set(0.5);
    lizard.x = x;
    lizard.y = y;
    lizard.play();

    parentContainer.addChild(lizard);

    // Pick angle biased toward the nearest screen edge so it exits fast
    const angle = getOutwardAngle(x, y, parentContainer.width, parentContainer.height);
    const speed = 1.5 + Math.random() * 1.5;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    // Point the sprite in travel direction
    // Offset by π/2 if your art faces upward; remove if it faces right
    lizard.rotation = angle + Math.PI / 2;

    const onTick = () => {
        lizard.x += vx;
        lizard.y += vy;

        // Destroy once offscreen — straight line means it never returns
        const margin = 120;
        if (
            lizard.x < -margin ||
            lizard.x > parentContainer.width  + margin ||
            lizard.y < -margin ||
            lizard.y > parentContainer.height + margin
        ) {
            app.ticker.remove(onTick);
            lizard.destroy();
        }
    };

    app.ticker.add(onTick);
}

/**
 * Returns an angle pointing from (x, y) toward the nearest screen edge
 * with some random spread so lizards don't all exit the same way.
 */
function getOutwardAngle(x, y, w, h) {
    const distLeft   = x;
    const distRight  = w - x;
    const distTop    = y;
    const distBottom = h - y;
    const minDist    = Math.min(distLeft, distRight, distTop, distBottom);

    let baseAngle;
    if (minDist === distLeft)        baseAngle = Math.PI;       // left
    else if (minDist === distRight)  baseAngle = 0;             // right
    else if (minDist === distTop)    baseAngle = -Math.PI / 2;  // up
    else                             baseAngle = Math.PI / 2;   // down

    // Add spread of ±45° so they fan out naturally
    const spread = (Math.random() - 0.5) * (Math.PI / 2);
    return baseAngle + spread;
}