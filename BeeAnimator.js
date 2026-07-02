// BeeAnimator.js — canvas-overlay bee, renders ON TOP of the archive panel DOM
// Spawns at close button, crawls left, stays behind when panel closes

const ASSET_PATH = 'assets/ANIMATION-SPRITES/bee/';
const BEE_SCALE = 0.4;
const CRAWL_SPEED = 0.8;
const EMERGE_SPEED = 0.9;
const CRAWL_ANIM_SPEED = 0.15;
const FLUTTER_ANIM_SPEED = 0.25;
const IDLE_DURATION_MIN = 1500;
const IDLE_DURATION_MAX = 3000;
const CRAWL_DURATION_MIN = 2000;
const CRAWL_DURATION_MAX = 4000;
const FLUTTER_TIMEOUT = 800;
const ROTATION_LERP = 0.06;
const EXIT_SPEED = 1.4;

let canvas = null, ctx = null;
let idleImg = null, crawlImgs = [], flutterImgs = [];
let loaded = false;
let activeBee = null;

export async function initBeeAnimator() {
    if (loaded) return;

    canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9500;';
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);

    try {
        idleImg = await loadImg(`${ASSET_PATH}idle/0.png`);
        for (let i = 0; i < 5; i++) crawlImgs.push(await loadImg(`${ASSET_PATH}crawl/${i}.png`));
        for (let i = 0; i < 8; i++) flutterImgs.push(await loadImg(`${ASSET_PATH}flutter/${i}.png`));
        loaded = true;
    } catch (err) {
        console.warn('BeeAnimator: could not load frames –', err);
    }
}

function loadImg(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Missing: ' + src));
        img.src = src;
    });
}

function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function angleTo(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

export function spawnBee(spawnX, spawnY) {
    if (!loaded) return null;
    if (activeBee) { activeBee._kill(); activeBee = null; }

    // Settle position: close button area (top-right of panel)
    const homeX = 1300;
    const homeY = 60;

    // Panel bounds for random wander targets
    const PANEL_LEFT = 430;
    const PANEL_RIGHT = 1320;
    const PANEL_TOP = 100;
    const PANEL_BOTTOM = 850;

    let x = spawnX, y = spawnY;
    let state = 'emerging';
    let targetX = homeX, targetY = homeY;
    let prevX = spawnX, prevY = spawnY;
    let progress = 0;
    let speed = EMERGE_SPEED;
    let rotation = angleTo(spawnX, spawnY, homeX, homeY) + Math.PI / 2;
    let targetRotation = rotation;
    let frameCount = 0;
    let animFrame = 0;
    let animTimer = 0;
    let stateTimer = null;
    let flutterTimer = null;
    let killed = false;
    let animId = null;

    // Current frame set
    let currentFrames = crawlImgs;
    let currentAnimSpeed = CRAWL_ANIM_SPEED;
    let animPlaying = true;

    // Exit
    let exitWaypoints = [];
    let exitWpIndex = 0;

    function pickCrawlTarget() {
        // Random point anywhere on the archive panel
        const tx = PANEL_LEFT + Math.random() * (PANEL_RIGHT - PANEL_LEFT);
        const ty = PANEL_TOP + Math.random() * (PANEL_BOTTOM - PANEL_TOP);
        return { x: tx, y: ty };
    }

    function switchToIdle() {
        if (state === 'exiting' || state === 'emerging') return;
        state = 'idle';
        currentFrames = [idleImg];
        animFrame = 0;
        animPlaying = false;
        clearTimeout(stateTimer);
        const dur = IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
        stateTimer = setTimeout(() => switchToCrawl(), dur);
    }

    function switchToCrawl() {
        if (state === 'exiting' || state === 'emerging') return;
        state = 'crawling';
        currentFrames = crawlImgs;
        currentAnimSpeed = CRAWL_ANIM_SPEED;
        animFrame = 0;
        animPlaying = true;
        speed = CRAWL_SPEED;

        const t = pickCrawlTarget();
        targetX = t.x; targetY = t.y;
        prevX = x; prevY = y;
        progress = 0;
        targetRotation = angleTo(prevX, prevY, targetX, targetY) + Math.PI / 2;

        clearTimeout(stateTimer);
        const dur = CRAWL_DURATION_MIN + Math.random() * (CRAWL_DURATION_MAX - CRAWL_DURATION_MIN);
        stateTimer = setTimeout(() => switchToIdle(), dur);
    }

    function switchToFlutter() {
        if (state === 'exiting' || state === 'emerging') return;
        clearTimeout(stateTimer);
        state = 'fluttering';
        currentFrames = flutterImgs;
        currentAnimSpeed = FLUTTER_ANIM_SPEED;
        animFrame = 0;
        animPlaying = true;
        // Drift target
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 40;
        targetX = x + Math.cos(angle) * dist;
        targetY = y + Math.sin(angle) * dist;
    }

    function smoothRotate() {
        let diff = targetRotation - rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        rotation += diff * ROTATION_LERP;
    }

    function drawBee() {
        if (!ctx || killed) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Advance animation
        if (animPlaying && currentFrames.length > 1) {
            animTimer += currentAnimSpeed;
            if (animTimer >= 1) {
                animTimer = 0;
                animFrame = (animFrame + 1) % currentFrames.length;
            }
        }

        const img = currentFrames[Math.min(animFrame, currentFrames.length - 1)];
        if (!img) return;

        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(BEE_SCALE, BEE_SCALE);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
    }

    function tick() {
        if (killed) return;
        frameCount++;
        animId = requestAnimationFrame(tick);

        smoothRotate();

        if (state === 'idle') {
            drawBee();
            return;
        }

        if (state === 'fluttering') {
            // Drift toward target
            const dx = targetX - x;
            const dy = targetY - y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 2) {
                x += (dx / dist) * 0.5;
                y += (dy / dist) * 0.5;
                targetRotation = angleTo(x, y, targetX, targetY) + Math.PI / 2;
            }
            drawBee();
            return;
        }

        if (state === 'emerging' || state === 'crawling') {
            const dx = targetX - prevX;
            const dy = targetY - prevY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 2) {
                x = targetX; y = targetY;
                state = 'arrived';
                clearTimeout(stateTimer);
                switchToIdle();
                drawBee();
                return;
            }

            const step = speed / Math.max(dist, 1);
            progress += step;

            if (progress >= 1) {
                x = targetX; y = targetY;
                state = 'arrived';
                clearTimeout(stateTimer);
                switchToIdle();
            } else {
                x = prevX + dx * progress;
                y = prevY + dy * progress;
            }
            drawBee();
            return;
        }

        if (state === 'exiting') {
            const target = exitWaypoints[exitWpIndex];
            if (!target) { cleanup(); return; }

            const dx = target.x - prevX;
            const dy = target.y - prevY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const step = EXIT_SPEED / Math.max(dist, 1);
            progress += step;

            if (progress >= 1) {
                x = target.x; y = target.y;
                prevX = target.x; prevY = target.y;
                progress = 0;
                exitWpIndex++;
                const next = exitWaypoints[exitWpIndex];
                if (next) targetRotation = angleTo(prevX, prevY, next.x, next.y) + Math.PI / 2;
            } else {
                x = prevX + dx * progress;
                y = prevY + dy * progress;
            }

            const margin = 200;
            if (x < -margin || x > canvas.width + margin ||
                y < -margin || y > canvas.height + margin) {
                cleanup();
                return;
            }
            drawBee();
        }
    }

    function cleanup() {
        killed = true;
        if (animId) cancelAnimationFrame(animId);
        clearTimeout(stateTimer);
        clearTimeout(flutterTimer);
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        activeBee = null;
    }

    animId = requestAnimationFrame(tick);

    const instance = {
        onScroll() {
            if (state === 'exiting' || state === 'emerging') return;
            if (state !== 'fluttering') switchToFlutter();
            clearTimeout(flutterTimer);
            flutterTimer = setTimeout(() => {
                if (state === 'fluttering') switchToIdle();
            }, FLUTTER_TIMEOUT);
        },
        drop() {
            if (state === 'exiting') return;
            clearTimeout(stateTimer);
            clearTimeout(flutterTimer);

            state = 'exiting';
            currentFrames = crawlImgs;
            currentAnimSpeed = CRAWL_ANIM_SPEED;
            animPlaying = true;

            const dL = x, dR = canvas.width - x;
            const dT = y, dB = canvas.height - y;
            const minD = Math.min(dL, dR, dT, dB);

            let baseAngle;
            if (minD === dL) baseAngle = Math.PI;
            else if (minD === dR) baseAngle = 0;
            else if (minD === dT) baseAngle = -Math.PI / 2;
            else baseAngle = Math.PI / 2;
            const exitAngle = baseAngle + (Math.random() - 0.5) * 0.5;

            const midX = x + Math.cos(exitAngle) * 200;
            const midY = y + Math.sin(exitAngle) * 200;
            const farX = x + Math.cos(exitAngle) * 600;
            const farY = y + Math.sin(exitAngle) * 600;

            exitWaypoints = [{ x: midX, y: midY }, { x: farX, y: farY }];
            exitWpIndex = 0;
            prevX = x; prevY = y;
            progress = 0;
            targetRotation = angleTo(x, y, midX, midY) + Math.PI / 2;
        },
        _kill: cleanup
    };

    activeBee = instance;
    return instance;
}
