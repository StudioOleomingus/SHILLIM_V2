import { app } from './Config.js';

let parentContainer = null;
let lastSpawnX = null;
let lastSpawnY = null;

// ── Creature definitions ────────────────────────────────────────────
const CREATURES = [
    {
        name: 'ant',
        folder: 'assets/ant/',
        frameCount: 6,
        maxCells: 10,
        scale: 0.1,
        animSpeed: 0.25,
        spawnCount: [4, 8],
        speed: 2.0,
        pathBuilder: buildAntPath
    },
    {
        name: 'beetle',
        folder: 'assets/beetle/',
        frameCount: 8,
        maxCells: 30,
        scale: 0.25,
        animSpeed: 0.18,
        spawnCount: [1, 1],
        speed: 1.3,
        pathBuilder: buildBeetlePath
    },
    {
        name: 'lizard',
        folder: 'assets/lizard/',
        frameCount: 8,
        maxCells: 50,
        scale: 0.6,
        animSpeed: 0.14,
        spawnCount: [1, 1],
        speed: 1.6,
        pathBuilder: buildLizardPath
    },
];

const frameCache = {};

// ── Init ─────────────────────────────────────────────────────────────
export async function initLizardAnimator(container) {
    parentContainer = container;

    for (const creature of CREATURES) {
        try {
            const frames = [];
            for (let i = 0; i < creature.frameCount; i++) {
                const texture = await PIXI.Assets.load(`${creature.folder}${i}.png`);
                frames.push(texture);
            }
            frameCache[creature.name] = frames;
        } catch (err) {
            console.warn(`CreatureAnimator: could not load ${creature.name} –`, err);
        }
    }
}

// ── Spawn point ──────────────────────────────────────────────────────
export function setSpawnPoint(x, y) {
    lastSpawnX = x;
    lastSpawnY = y;
}

// ── Public spawn ─────────────────────────────────────────────────────
export function spawnLizard(x, y, groupSize) {
    if (!parentContainer) return;

    x = x ?? lastSpawnX ?? parentContainer.width / 2;
    y = y ?? lastSpawnY ?? parentContainer.height / 2;

    const creature = pickCreature(groupSize ?? 25);
    const frames = frameCache[creature.name];
    if (!frames || frames.length === 0) return;

    const [minCount, maxCount] = creature.spawnCount;
    const count = minCount + Math.floor(Math.random() * (maxCount - minCount + 1));

    for (let i = 0; i < count; i++) {
        const offsetX = count > 1 ? (Math.random() - 0.5) * 30 : 0;
        const offsetY = count > 1 ? (Math.random() - 0.5) * 30 : 0;
        const delay = count > 1 ? i * (80 + Math.random() * 120) : 0;

        setTimeout(() => {
            spawnOne(frames, creature, x + offsetX, y + offsetY);
        }, delay);
    }
}

// ── Internal: spawn and walk a waypoint path ─────────────────────────
function spawnOne(frames, creature, x, y) {
    const sprite = new PIXI.AnimatedSprite(frames);
    sprite.animationSpeed = creature.animSpeed;
    sprite.anchor.set(0.5);
    sprite.scale.set(creature.scale);
    sprite.x = x;
    sprite.y = y;
    sprite.play();

    parentContainer.addChild(sprite);

    const exitAngle = getOutwardAngle(x, y, parentContainer.width, parentContainer.height);
    const waypoints = creature.pathBuilder(x, y, exitAngle, parentContainer.width, parentContainer.height);

    let wpIndex = 0;
    let prevX = x;
    let prevY = y;
    let progress = 0;

    sprite.rotation = angleTo(x, y, waypoints[0].x, waypoints[0].y) + Math.PI / 2;

    const onTick = () => {
        const target = waypoints[wpIndex];
        if (!target) {
            app.ticker.remove(onTick);
            sprite.destroy();
            return;
        }

        const dx = target.x - prevX;
        const dy = target.y - prevY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = creature.speed / Math.max(dist, 1);

        progress += step;

        if (progress >= 1) {
            sprite.x = target.x;
            sprite.y = target.y;
            prevX = target.x;
            prevY = target.y;
            progress = 0;
            wpIndex++;

            const next = waypoints[wpIndex];
            if (next) {
                sprite.rotation = angleTo(prevX, prevY, next.x, next.y) + Math.PI / 2;
            }
        } else {
            sprite.x = prevX + dx * progress;
            sprite.y = prevY + dy * progress;
        }

        const margin = 150;
        if (
            sprite.x < -margin ||
            sprite.x > parentContainer.width  + margin ||
            sprite.y < -margin ||
            sprite.y > parentContainer.height + margin
        ) {
            app.ticker.remove(onTick);
            sprite.destroy();
        }
    };

    app.ticker.add(onTick);
}

// ═══════════════════════════════════════════════════════════════════════
// PATH BUILDERS
// Each returns an array of { x, y } waypoints.
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ants: many short segments with wide angular scatter.
 * Feels jittery and exploratory but always drifts outward.
 */
function buildAntPath(startX, startY, exitAngle) {
    const points = [];
    let x = startX;
    let y = startY;
    const segments = 14 + Math.floor(Math.random() * 8);

    for (let i = 0; i < segments; i++) {
        const len = 12 + Math.random() * 20;
        const scatter = (Math.random() - 0.5) * Math.PI * 1.2;
        const angle = exitAngle + scatter * (1 - i / segments * 0.4); // tighten toward exit over time
        x += Math.cos(angle) * len;
        y += Math.sin(angle) * len;
        points.push({ x, y });
    }

    // Final point offscreen
    x += Math.cos(exitAngle) * 300;
    y += Math.sin(exitAngle) * 300;
    points.push({ x, y });
    return points;
}

/**
 * Beetles: smooth S-curves — alternating perpendicular sweeps
 * that weave across the exit line.
 */
function buildBeetlePath(startX, startY, exitAngle) {
    const points = [];
    let x = startX;
    let y = startY;
    const segments = 5 + Math.floor(Math.random() * 3);
    const curveDir = Math.random() < 0.5 ? 1 : -1;

    for (let i = 0; i < segments; i++) {
        const segLen = 60 + Math.random() * 80;
        const side = curveDir * (i % 2 === 0 ? 1 : -1);
        const perpAngle = exitAngle + (Math.PI / 2) * side;
        const sweep = 30 + Math.random() * 40;

        // Arc midpoint
        const midX = x + Math.cos(exitAngle) * segLen * 0.5 + Math.cos(perpAngle) * sweep;
        const midY = y + Math.sin(exitAngle) * segLen * 0.5 + Math.sin(perpAngle) * sweep;
        points.push({ x: midX, y: midY });

        // Segment end — back on the exit line
        x += Math.cos(exitAngle) * segLen;
        y += Math.sin(exitAngle) * segLen;
        points.push({ x, y });
    }

    x += Math.cos(exitAngle) * 300;
    y += Math.sin(exitAngle) * 300;
    points.push({ x, y });
    return points;
}

/**
 * Lizards: long gentle arc — a single smooth curve that bends
 * gradually, like a lizard picking a path through terrain.
 */
function buildLizardPath(startX, startY, exitAngle) {
    const points = [];
    let x = startX;
    let y = startY;
    const segments = 6;
    const curveBias = (Math.random() - 0.5) * 0.15; // slight consistent bend
    let angle = exitAngle;

    for (let i = 0; i < segments; i++) {
        const segLen = 70 + Math.random() * 50;
        angle += curveBias + (Math.random() - 0.5) * 0.1;
        x += Math.cos(angle) * segLen;
        y += Math.sin(angle) * segLen;
        points.push({ x, y });
    }

    x += Math.cos(angle) * 400;
    y += Math.sin(angle) * 400;
    points.push({ x, y });
    return points;
}

// ── Helpers ──────────────────────────────────────────────────────────
function pickCreature(groupSize) {
    for (const creature of CREATURES) {
        if (groupSize <= creature.maxCells) return creature;
    }
    return CREATURES[CREATURES.length - 1];
}

function getOutwardAngle(x, y, w, h) {
    const distLeft   = x;
    const distRight  = w - x;
    const distTop    = y;
    const distBottom = h - y;
    const minDist    = Math.min(distLeft, distRight, distTop, distBottom);

    let baseAngle;
    if (minDist === distLeft)        baseAngle = Math.PI;
    else if (minDist === distRight)  baseAngle = 0;
    else if (minDist === distTop)    baseAngle = -Math.PI / 2;
    else                             baseAngle = Math.PI / 2;

    const spread = (Math.random() - 0.5) * (Math.PI / 2);
    return baseAngle + spread;
}

function angleTo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}