// FrogAnimator.js — frog waits under card, moves only after drop() is called
import { app } from './Config.js';

const FRAME_COUNT = 7;
const FROG_SCALE = 0.6;
const BURST_SPEED = 8.0;
const ANIM_SPEED = 0.18;
const PAUSE_MS = 1500;
const ROTATION_LERP = 0.04;
const HOP_DISTANCE_MIN = 80;
const HOP_DISTANCE_MAX = 160;

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
    sprite.gotoAndStop(0); // frozen — waiting under card
    app.stage.addChild(sprite);

    // State: 'waiting' → 'hopping' → 'paused' → 'exiting'
    let state = 'waiting';

    // Build path on drop: hop1 → pause → exit off screen
    let waypoints = [];
    let wpIndex = 0;
    let prevX = spawnX;
    let prevY = spawnY;
    let progress = 0;
    let targetRotation = 0;

    function smoothRotate() {
        let diff = targetRotation - sprite.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        sprite.rotation += diff * ROTATION_LERP;
    }

    const onTick = () => {
        if (state === 'waiting' || state === 'paused') {
            if (state === 'paused') smoothRotate();
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

            if (!isLastHop && state === 'hopping') {
                // First hop done — pause, turn toward exit
                state = 'paused';
                sprite.stop();

                const next = waypoints[wpIndex];
                targetRotation = angleTo(prevX, prevY, next.x, next.y) + Math.PI / 2;

                setTimeout(() => {
                    state = 'exiting';
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

    return {
        drop() {
            if (state !== 'waiting') return;

            // Build path: hop to nearby spot, then exit off screen
            let angle = Math.random() * Math.PI * 2;
            const hopDist = HOP_DISTANCE_MIN + Math.random() * (HOP_DISTANCE_MAX - HOP_DISTANCE_MIN);
            const hop1X = spawnX + Math.cos(angle) * hopDist;
            const hop1Y = spawnY + Math.sin(angle) * hopDist;

            // Exit: continue in a slightly different direction
            angle += (Math.random() - 0.5) * 0.1;
            const exitX = hop1X + Math.cos(angle) * 700;
            const exitY = hop1Y + Math.sin(angle) * 700;

            waypoints = [
                { x: hop1X, y: hop1Y },
                { x: exitX, y: exitY }
            ];
            wpIndex = 0;
            prevX = sprite.x;
            prevY = sprite.y;
            progress = 0;

            targetRotation = angleTo(prevX, prevY, hop1X, hop1Y) + Math.PI / 2;
            sprite.rotation = targetRotation;
            sprite.play();
            state = 'hopping';
        }
    };
}
