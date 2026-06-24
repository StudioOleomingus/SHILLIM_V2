import { app } from './Config.js';

let parentContainer = null;
let lastSpawnX = null;
let lastSpawnY = null;

// ── Creature definitions ────────────────────────────────────────────
const CREATURES = [
    {
        name: 'ant',
        folder: 'assets/ant/',
        frameCount: 12,
        maxCells: 12,
        scale: 0.1,
        animSpeed: 0.25,
        spawnCount: [4, 8],
        speed: 2.0,
        pathBuilder: buildAntPath
    },
    {
        name: 'beetle',
        folder: 'assets/beetle/',
        frameCount: 11,
        maxCells: 40,
        scale: 0.25,
        animSpeed: 0.18,
        spawnCount: [1, 1],
        speed: 1.6,
        pathBuilder: buildBeetlePath
    },
    {
        name: 'lizard',
        folder: 'assets/lizard/',
        frameCount: 11,
        maxCells: Infinity,
        scale: 0.6,
        animSpeed: 0.16,
        spawnCount: [1, 1],
        speed: 3.4,
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

    // Shared exit angle so ant colony converges on the same heading
    const exitAngle = getOutwardAngle(x, y, parentContainer.width, parentContainer.height);

    for (let i = 0; i < count; i++) {
        const offsetX = count > 1 ? (Math.random() - 0.5) * 30 : 0;
        const offsetY = count > 1 ? (Math.random() - 0.5) * 30 : 0;
        const delay = count > 1 ? i * (80 + Math.random() * 120) : 0;

        setTimeout(() => {
            spawnOne(frames, creature, x + offsetX, y + offsetY, exitAngle);
        }, delay);
    }
}

// ── Internal: spawn and walk a waypoint path ─────────────────────────
function spawnOne(frames, creature, x, y, exitAngle) {
    const sprite = new PIXI.AnimatedSprite(frames);
    sprite.animationSpeed = creature.animSpeed;
    sprite.anchor.set(0.5);
    sprite.scale.set(creature.scale);
    sprite.x = x;
    sprite.y = y;
    sprite.play();

    parentContainer.addChild(sprite);

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
// ═══════════════════════════════════════════════════════════════════════

/**
 * Ants: three phases —
 *   1. SCATTER  – burst outward in a random direction away from spawn
 *   2. WANDER   – keep going roughly in the scattered direction with wobble
 *   3. CONVERGE – gradually arc back toward the shared exit heading at the end
 *
 * Each ant fans out on its own path for most of the journey,
 * only pulling together near the screen edge.
 */
function buildAntPath(startX, startY, exitAngle) {
    const points = [];
    let x = startX;
    let y = startY;

    // Each ant gets a unique heading well away from the exit
    const scatterAngle = exitAngle + Math.PI * (0.3 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
    let angle = scatterAngle;

    // ── Phase 1: Scatter ──
    // Quick burst outward in the scattered direction
    const scatterSteps = 3;
    for (let i = 0; i < scatterSteps; i++) {
        const len = 10 + Math.random() * 15;
        const jitter = (Math.random() - 0.5) * 0.3;
        x += Math.cos(angle + jitter) * len;
        y += Math.sin(angle + jitter) * len;
        points.push({ x, y });
    }

    // ── Phase 2: Wander ──
    // Continue roughly in the scattered direction — this is the bulk of the path
    const wanderSteps = 10 + Math.floor(Math.random() * 6);
    for (let i = 0; i < wanderSteps; i++) {
        const wobble = (Math.random() - 0.5) * 0.6;
        const len = 12 + Math.random() * 18;
        angle += wobble * 0.3; // slow drift, mostly keeps scattered heading
        x += Math.cos(angle) * len;
        y += Math.sin(angle) * len;
        points.push({ x, y });
    }

    // ── Phase 3: Converge ──
    // Arc toward the shared exit heading over the final waypoints
    const convergeSteps = 5;
    const angleDiff = normalizeAngle(exitAngle - angle);
    for (let i = 1; i <= convergeSteps; i++) {
        const t = i / convergeSteps;
        angle += angleDiff * t * 0.35;
        const len = 14 + Math.random() * 16;
        x += Math.cos(angle) * len;
        y += Math.sin(angle) * len;
        points.push({ x, y });
    }

    // Final offscreen along exit
    x += Math.cos(exitAngle) * 300;
    y += Math.sin(exitAngle) * 300;
    points.push({ x, y });
    return points;
}

/**
 * Beetles: slight continuous curve toward the nearest edge.
 * One gentle arc — no S-curves, no reversals.
 */
function buildBeetlePath(startX, startY, exitAngle) {
    const points = [];
    let x = startX;
    let y = startY;
    const segments = 6;

    // Small consistent bend in one direction
    const curveBias = (Math.random() < 0.5 ? 1 : -1) * (0.04 + Math.random() * 0.06);
    let angle = exitAngle;

    for (let i = 0; i < segments; i++) {
        const segLen = 50 + Math.random() * 40;
        angle += curveBias;
        x += Math.cos(angle) * segLen;
        y += Math.sin(angle) * segLen;
        points.push({ x, y });
    }

    x += Math.cos(angle) * 350;
    y += Math.sin(angle) * 350;
    points.push({ x, y });
    return points;
}

/**
 * Lizards: beeline — straight to the edge, no turns.
 * Two waypoints: one mid-distance, one well offscreen.
 */
function buildLizardPath(startX, startY, exitAngle) {
    return [
        {
            x: startX + Math.cos(exitAngle) * 200,
            y: startY + Math.sin(exitAngle) * 200
        },
        {
            x: startX + Math.cos(exitAngle) * 600,
            y: startY + Math.sin(exitAngle) * 600
        }
    ];
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

/** Normalize angle to -π…π */
function normalizeAngle(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
}