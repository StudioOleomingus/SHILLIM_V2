// FrogAnimator.js — frog burst-crawls: quick hop → freeze → turn → hop → freeze → exit
import { app } from './Config.js';

const FRAME_COUNT = 7;
const FROG_SCALE = 0.3;
const BURST_SPEED = 5.0;
const ANIM_SPEED = 0.18;
const PAUSE_MS = 300;
const ROTATION_LERP = 0.12;
const HOP_DISTANCE_MIN = 80;
const HOP_DISTANCE_MAX = 160;
const HOP_COUNT = 2;          // number of burst-hops before exiting

let frames = null;
let loaded = false;

export async function initFrogAnimator() {
    if (loaded) return;
    try {
        const textures = [];
        for (let i = 0; i < FRAME_COUNT; i++) {
            const pad = String(i).padStart(2, '0');
            const tex = await PIXI.Assets.load(`assets/ANIMATION-SPRITES/Frog/Frogcycle_${pad}.png`);
            textures.push(tex);
        }
        frames = textures;
        loaded = true;
    } catch (err) {
        console.warn('FrogAnimator: could not load frames –', err);
    }
}

function angleTo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

export function spawnFrog(spawnX, spawnY) {
    if (!loaded || !frames) return null;

    const sprite = new PIXI.AnimatedSprite(frames);
    sprite.anchor.set(0.5);
    sprite.animationSpeed = ANIM_SPEED;
    sprite.scale.set(FROG_SCALE);
    sprite.x = spawnX;
    sprite.y = spawnY;
    sprite.play();
    app.stage.addChild(sprite);

    // Build hop waypoints: random direction changes
    const waypoints = [];
    let angle = Math.random() * Math.PI * 2;
    let wx = spawnX;
    let wy = spawnY;

    for (let i = 0; i < HOP_COUNT; i++) {
        // Each hop turns slightly from the previous direction
        angle += (Math.random() - 0.5) * 1.2;
        const dist = HOP_DISTANCE_MIN + Math.random() * (HOP_DISTANCE_MAX - HOP_DISTANCE_MIN);
        wx += Math.cos(angle) * dist;
        wy += Math.sin(angle) * dist;
        waypoints.push({ x: wx, y: wy });
    }

    // Final hop: long burst off screen in the current direction
    wx += Math.cos(angle) * 700;
    wy += Math.sin(angle) * 700;
    waypoints.push({ x: wx, y: wy });

    let wpIndex = 0;
    let prevX = spawnX;
    let prevY = spawnY;
    let progress = 0;
    let paused = false;
    let targetRotation = angleTo(spawnX, spawnY, waypoints[0].x, waypoints[0].y) + Math.PI / 2;
    sprite.rotation = targetRotation;

    function smoothRotate() {
        let diff = targetRotation - sprite.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        sprite.rotation += diff * ROTATION_LERP;
    }

    const onTick = () => {
        if (paused) {
            smoothRotate(); // still turning during pause
            return;
        }

        smoothRotate();

        const target = waypoints[wpIndex];
        if (!target) {
            app.ticker.remove(onTick);
            if (sprite.parent) sprite.parent.removeChild(sprite);
            sprite.destroy();
            return;
        }

        const dx = target.x - prevX;
        const dy = target.y - prevY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = BURST_SPEED / Math.max(dist, 1);
        progress += step;

        if (progress >= 1) {
            sprite.x = target.x;
            sprite.y = target.y;
            prevX = target.x;
            prevY = target.y;
            progress = 0;
            wpIndex++;

            const isLastHop = wpIndex >= waypoints.length;

            if (!isLastHop) {
                // Pause on a frame, then turn toward next waypoint
                paused = true;
                sprite.stop();

                const next = waypoints[wpIndex];
                targetRotation = angleTo(prevX, prevY, next.x, next.y) + Math.PI / 2;

                setTimeout(() => {
                    paused = false;
                    sprite.play();
                }, PAUSE_MS);
            }
        } else {
            sprite.x = prevX + dx * progress;
            sprite.y = prevY + dy * progress;
        }

        // Off screen check
        const margin = 200;
        if (sprite.x < -margin || sprite.x > app.screen.width + margin ||
            sprite.y < -margin || sprite.y > app.screen.height + margin) {
            app.ticker.remove(onTick);
            if (sprite.parent) sprite.parent.removeChild(sprite);
            sprite.destroy();
        }
    };

    app.ticker.add(onTick);

    return { drop() {} };
}