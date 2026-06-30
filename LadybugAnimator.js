import { app } from './Config.js';

const FRAME_COUNTS = { idle: 1, walk: 8, transition: 8 };

let idleFrames = null;
let walkFrames = null;
let transitionFrames = null;

export async function initLadybugAnimator() {
    idleFrames = await loadFrames('assets/ANIMATION-SPRITES/ladybug/idle/', FRAME_COUNTS.idle);
    walkFrames = await loadFrames('assets/ANIMATION-SPRITES/ladybug/walk/', FRAME_COUNTS.walk);
    transitionFrames = await loadFrames('assets/ANIMATION-SPRITES/ladybug/idle-to-active/', FRAME_COUNTS.transition);

    if (!idleFrames) idleFrames = makePlaceholderFrames(0xCC3333, 4);
    if (!walkFrames) walkFrames = makePlaceholderFrames(0xCC3333, 4);
    if (!transitionFrames) transitionFrames = makePlaceholderFrames(0x333333, 4);
}

async function loadFrames(folder, count) {
    try {
        const frames = [];
        for (let i = 0; i < count; i++) {
            const texture = await PIXI.Assets.load(`${folder}${i}.png`);
            frames.push(texture);
        }
        return frames;
    } catch (err) {
        console.warn('LadybugAnimator: missing frames at', folder);
        return null;
    }
}

function makePlaceholderFrames(color, count) {
    const frames = [];
    for (let i = 0; i < count; i++) {
        const size = 32;
        const gfx = new PIXI.Graphics();
        gfx.beginFill(color, 0.8);
        gfx.drawEllipse(size / 2, size / 2, size / 2, size * 0.35);
        gfx.endFill();
        gfx.beginFill(0x000000, 0.4);
        gfx.drawCircle(size * 0.3 + i * 3, size * 0.4, 3);
        gfx.endFill();
        frames.push(app.renderer.generateTexture(gfx));
        gfx.destroy();
    }
    return frames;
}

// ── Spawn ────────────────────────────────────────────────────────────
export function spawnLadybug(parent, targetX) {
    if (!idleFrames || !walkFrames || !transitionFrames) return null;

    const sprite = new PIXI.AnimatedSprite(walkFrames);
    sprite.animationSpeed = 0.15;
    sprite.anchor.set(0.5);
    sprite.play();

    const container = new PIXI.Container();
    container.addChild(sprite);
    container.scale.set(0.25);
    container.rotation = Math.PI / 2;

    // Random entry point along the left edge
    const cardHeight = parent.height || (app.screen.height - 160);
    const entryY = 40 + Math.random() * (cardHeight - 80);
    container.x = -20;
    container.y = entryY;
    parent.addChild(container);

    // Random destination anywhere on the card
    const cardWidth = 408;
    const padX = 40;
    const padY = 60;
    const destX = padX + Math.random() * (cardWidth - padX * 2);
    const destY = padY + Math.random() * (cardHeight - padY * 2);

    // Random settle rotation
    const settleRotation = Math.random() * Math.PI * 2;

    const waypoints = buildWanderPath(container.x, container.y, destX, destY, cardWidth, cardHeight);

    let wpIndex = 0;
    let settled = false;
    let exitAfterSettle = false;
    let exiting = false;
    let exitWaypoints = null;
    let exitWpIndex = 0;
    const SPEED = 0.6;
    let prevX = container.x;
    let prevY = container.y;
    let progress = 0;

    function faceTarget(tx, ty) {
        const angle = Math.atan2(ty - container.y, tx - container.x);
        container.rotation = angle + Math.PI / 2;
    }

    if (waypoints.length > 0) {
        faceTarget(waypoints[0].x, waypoints[0].y);
    }

    const onTick = () => {
        if (settled && !exiting) return;

        const wps = exiting ? exitWaypoints : waypoints;
        const idx = exiting ? exitWpIndex : wpIndex;
        const target = wps[idx];

        if (!target) {
            if (exiting) {
                app.ticker.remove(onTick);
                if (container.parent) container.parent.removeChild(container);
                container.destroy({ children: true });
                return;
            }
            // Settle: switch to idle and rotate to rest angle
            settled = true;
            sprite.textures = idleFrames;
            sprite.animationSpeed = 0.08;
            sprite.play();
            container.rotation = settleRotation;
            // If the detail box was closed mid-walk, crawl out after a pause
            if (exitAfterSettle) scheduleExit(4000);
            return;
        }

        const dx = target.x - prevX;
        const dy = target.y - prevY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const step = SPEED / Math.max(dist, 1);

        progress += step;

        if (progress >= 1) {
            container.x = target.x;
            container.y = target.y;
            prevX = target.x;
            prevY = target.y;
            progress = 0;

            if (exiting) exitWpIndex++;
            else wpIndex++;

            const nextIdx = exiting ? exitWpIndex : wpIndex;
            const nextTarget = wps[nextIdx];
            if (nextTarget) faceTarget(nextTarget.x, nextTarget.y);
        } else {
            container.x = prevX + dx * progress;
            container.y = prevY + dy * progress;
        }

        if (exiting) {
            const globalPos = container.getGlobalPosition();
            const margin = 100;
            if (globalPos.x < -margin || globalPos.x > app.screen.width + margin ||
                globalPos.y < -margin || globalPos.y > app.screen.height + margin) {
                app.ticker.remove(onTick);
                if (container.parent) container.parent.removeChild(container);
                container.destroy({ children: true });
            }
        }
    };

    app.ticker.add(onTick);

    // Detach from the (sliding) card onto the stage, keeping the same on-screen
    // position. Returns the local→global offset so any in-flight path can be
    // converted into stage coordinates.
    function reparentToStage() {
        const globalPos = container.getGlobalPosition();
        const offsetX = globalPos.x - container.x;
        const offsetY = globalPos.y - container.y;
        if (container.parent) container.parent.removeChild(container);
        container.x = globalPos.x;
        container.y = globalPos.y;
        app.stage.addChild(container);
        return { offsetX, offsetY };
    }

    function scheduleExit(delay) {
        setTimeout(() => {
            if (exiting) return;
            exiting = true;
            settled = false;

            sprite.textures = walkFrames;
            sprite.animationSpeed = 0.15;
            sprite.play();

            exitWaypoints = buildExitPath(container.x, container.y);
            exitWpIndex = 0;
            prevX = container.x;
            prevY = container.y;
            progress = 0;

            if (exitWaypoints.length > 0) {
                faceTarget(exitWaypoints[0].x, exitWaypoints[0].y);
            }
        }, delay);
    }

    return {
        drop() {
            if (exiting) return;

            // Still walking in: detach onto the stage so it stays on screen
            // instead of riding back with the card. Convert the remaining path
            // into stage coordinates, then let it finish walking and settle.
            if (!settled) {
                const { offsetX, offsetY } = reparentToStage();
                for (const wp of waypoints) { wp.x += offsetX; wp.y += offsetY; }
                prevX += offsetX;
                prevY += offsetY;
                exitAfterSettle = true;
                return;
            }

            // Already idle — reparent to stage so it stays in place, then crawl out
            reparentToStage();
            scheduleExit(4000);
        }
    };
}

// ── Path builders ────────────────────────────────────────────────────

function buildWanderPath(startX, startY, destX, destY, cardW, cardH) {
    const points = [];
    let x = startX;
    let y = startY;

    // 3–5 random waypoints wandering toward the destination
    const steps = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
        const t = (i + 1) / (steps + 1);
        x = startX + (destX - startX) * t + (Math.random() - 0.5) * 80;
        y = startY + (destY - startY) * t + (Math.random() - 0.5) * 60;
        x = Math.max(10, Math.min(cardW - 30, x));
        y = Math.max(10, Math.min(cardH - 30, y));
        points.push({ x, y });
    }

    // Final settle point
    points.push({ x: destX, y: destY });
    return points;
}

function buildExitPath(startX, startY) {
    const points = [];
    let x = startX;
    let y = startY;

    const distLeft = x;
    const distRight = app.screen.width - x;
    const distTop = y;
    const distBottom = app.screen.height - y;
    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    let angle;
    if (minDist === distLeft) angle = Math.PI;
    else if (minDist === distRight) angle = 0;
    else if (minDist === distTop) angle = -Math.PI / 2;
    else angle = Math.PI / 2;

    angle += (Math.random() - 0.5) * 0.8;

    const steps = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < steps; i++) {
        const wobble = (Math.random() - 0.5) * 0.4;
        const len = 40 + Math.random() * 60;
        angle += wobble * 0.3;
        x += Math.cos(angle) * len;
        y += Math.sin(angle) * len;
        points.push({ x, y });
    }

    x += Math.cos(angle) * 400;
    y += Math.sin(angle) * 400;
    points.push({ x, y });
    return points;
}