// FrogAnimator.js — frog waits under card, moves only after drop() is called
import { app } from './Config.js';

const FRAME_COUNT = 7;
const FROG_SCALE = 0.6;
const BURST_SPEED = 1.2;
const ANIM_SPEED = 0.14;
const HOP_DISTANCE_MIN = 80;
const HOP_DISTANCE_MAX = 160;
// How much the body leans into the curve (0 = always upright, 1 = full heading).
const LEAN_FACTOR = 0.3;

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

    // State: 'waiting' → 'moving'
    let state = 'waiting';

    // Build path on drop: hop1 → exit off screen (no pause)
    let waypoints = [];
    let wpIndex = 0;
    let prevX = spawnX;
    let prevY = spawnY;
    let progress = 0;

    const onTick = () => {
        if (state === 'waiting') return;

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

            // Face the next segment instantly — no pause, no easing.
            // Damp the lean so the body only tilts gently into the curve.
            const next = waypoints[wpIndex];
            if (next) {
                sprite.rotation = (angleTo(prevX, prevY, next.x, next.y) + Math.PI / 2) * LEAN_FACTOR;
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

            // Always start with a straight hop upward...
            const upHop = HOP_DISTANCE_MIN + Math.random() * (HOP_DISTANCE_MAX - HOP_DISTANCE_MIN);
            const startY = spawnY - upHop;
            waypoints = [{ x: spawnX, y: startY }];

            // ...then a wide, gentle S as it travels up and off the top.
            // x sways one way then the other (one full sine = an "S"); the tall
            // vertical travel keeps the slope — and so the turning — very gentle.
            const amplitude = 140 + Math.random() * 80;  // width of the S
            const sway = Math.random() < 0.5 ? 1 : -1;   // which way the S leans
            const endY = -700;                           // far above the top → long, gentle climb
            const steps = 40;
            for (let i = 1; i <= steps; i++) {
                const t = i / steps;
                const x = spawnX + sway * amplitude * Math.sin(t * Math.PI * 2);
                const y = startY + (endY - startY) * t;
                waypoints.push({ x, y });
            }

            wpIndex = 0;
            prevX = sprite.x;
            prevY = sprite.y;
            progress = 0;

            sprite.rotation = (angleTo(prevX, prevY, spawnX, startY) + Math.PI / 2) * LEAN_FACTOR;
            sprite.play();
            state = 'moving';
        }
    };
}
