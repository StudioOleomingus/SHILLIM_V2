// CaterpillarAnimator.js — canvas-overlay caterpillar for the archive panel
// Usage: import { initCaterpillar, spawnCaterpillar } from './CaterpillarAnimator.js'

const ASSET_PATH = 'assets/caterpillar/';
const SEGMENT_COUNT_MIN = 9;
const SEGMENT_COUNT_MAX = 12;
const SEGMENT_SPACING = 18;
const SPEED = 0.45;
const SCALE = 0.08;
const MAX_TURN_RATE = 0.018;

const HUMP_AMPLITUDE = 3;
const HUMP_FREQUENCY = 0.5;
const HUMP_SPEED = 0.04;
const HUMP_SCALE_BOOST = 0.015;

const SEGMENT_BULGE = 0.06;
const WOBBLE = 0.012;

const MOUSE_DELAY = 60;
const MOUSE_STOP_RADIUS = 150;

let canvas = null, ctx = null;
let headImg = null, bodyImg = null, tailImg = null;
let imagesLoaded = false;
let activeCaterpillar = null;

// ── Init: load images, create canvas ─────────────────────────────────
export function initCaterpillar() {
    return new Promise((resolve) => {
        if (imagesLoaded) { resolve(); return; }

        // Create fixed canvas overlay
        canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9500;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);

        let loadCount = 0;
        const onLoad = () => {
            if (++loadCount === 3) { imagesLoaded = true; resolve(); }
        };

        headImg = new Image();
        headImg.onload = onLoad;
        headImg.onerror = () => { console.warn('Caterpillar: missing head.png'); onLoad(); };
        headImg.src = ASSET_PATH + 'head.png';

        bodyImg = new Image();
        bodyImg.onload = onLoad;
        bodyImg.onerror = () => { console.warn('Caterpillar: missing body.png'); onLoad(); };
        bodyImg.src = ASSET_PATH + 'body.png';

        tailImg = new Image();
        tailImg.onload = onLoad;
        tailImg.onerror = () => { console.warn('Caterpillar: missing tail.png'); onLoad(); };
        tailImg.src = ASSET_PATH + 'tail.png';
    });
}

function resize() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// ── Spawn caterpillar ────────────────────────────────────────────────
export function spawnCaterpillar() {
    if (!imagesLoaded || !headImg || !bodyImg || !tailImg) return null;

    // Kill any existing caterpillar
    if (activeCaterpillar) {
        activeCaterpillar._kill();
        activeCaterpillar = null;
    }

    const segCount = SEGMENT_COUNT_MIN + Math.floor(Math.random() * (SEGMENT_COUNT_MAX - SEGMENT_COUNT_MIN + 1));
    const totalSegs = segCount + 2; // head + body + tail

    // Build segments
    const segments = [];
    segments.push({ type: 'head', img: headImg, segIndex: 0, trailOffset: 0 });
    for (let i = 1; i <= segCount; i++) {
        const offset = (i === 1) ? Math.floor(SEGMENT_SPACING * 0.25) : i * SEGMENT_SPACING;
        segments.push({ type: 'body', img: bodyImg, segIndex: i, trailOffset: offset });
    }
    segments.push({ type: 'tail', img: tailImg, segIndex: segCount + 1, trailOffset: (segCount + 1) * SEGMENT_SPACING + 4 });

    // Trail buffer
    const trailSize = (segCount + 4) * SEGMENT_SPACING + 200;
    const trail = new Array(trailSize);

    // Spawn from right edge
    const spawnX = canvas.width + 20;
    const spawnY = 100 + Math.random() * (canvas.height - 200);

    for (let i = 0; i < trailSize; i++) {
        trail[i] = { x: spawnX, y: spawnY, angle: Math.PI };
    }
    let trailHead = trailSize - 1;

    // Mouse tracking
    let mouseX = -1000, mouseY = -1000;
    const mouseHistory = [];
    for (let i = 0; i < MOUSE_DELAY + 10; i++) {
        mouseHistory.push({ x: spawnX, y: spawnY });
    }

    const onMouseMove = (e) => { mouseX = e.clientX; mouseY = e.clientY; };
    const onMouseLeave = () => { mouseX = -1000; mouseY = -1000; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseleave', onMouseLeave);

    let currentAngle = Math.PI;
    let wanderAngle = currentAngle;
    let frameCount = 0;
    let humpClock = 0;
    let settled = false;
    let exiting = false;
    let exitAngle = 0;
    let killed = false;
    let animId = null;

    function tick() {
        if (killed) return;
        frameCount++;
        animId = requestAnimationFrame(tick);

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const headX = trail[trailHead].x;
        const headY = trail[trailHead].y;

        if (settled && !exiting) {
            // Curled up — just keep drawing, don't move
            humpClock += 0.05;
            drawSegments();
            return;
        }

        if (exiting) {
            const wobbleAngle = exitAngle + Math.sin(frameCount * 0.03) * WOBBLE;
            const newX = headX + Math.cos(wobbleAngle) * SPEED * 1.5;
            const newY = headY + Math.sin(wobbleAngle) * SPEED * 1.5;

            trailHead = (trailHead + 1) % trail.length;
            trail[trailHead] = { x: newX, y: newY, angle: exitAngle };
            humpClock += 1;
            drawSegments();

            const margin = 200;
            if (newX < -margin || newX > canvas.width + margin ||
                newY < -margin || newY > canvas.height + margin) {
                cleanup();
            }
            return;
        }

        // Mouse history
        mouseHistory.push({ x: mouseX, y: mouseY });
        if (mouseHistory.length > MOUSE_DELAY + 10) mouseHistory.shift();
        const delayIdx = Math.max(0, mouseHistory.length - MOUSE_DELAY);
        const delayedMouse = mouseHistory[delayIdx];

        const distToMouse = Math.sqrt((mouseX - headX) ** 2 + (mouseY - headY) ** 2);
        const mouseOnScreen = mouseX > -500 && mouseY > -500;

        let desiredAngle;

        if (mouseOnScreen && distToMouse < MOUSE_STOP_RADIUS) {
            // Reached mouse — curl and STAY permanently
            settled = true;
            trailHead = (trailHead + 1) % trail.length;
            trail[trailHead] = { x: headX, y: headY, angle: currentAngle };
            drawSegments();
            return;
        } else if (mouseOnScreen) {
            // Meander toward delayed mouse
            const dxTarget = delayedMouse.x - headX;
            const dyTarget = delayedMouse.y - headY;
            const mouseAngle = Math.atan2(dyTarget, dxTarget);

            let drift = mouseAngle - wanderAngle;
            while (drift > Math.PI) drift -= Math.PI * 2;
            while (drift < -Math.PI) drift += Math.PI * 2;
            wanderAngle += drift * 0.02;
            wanderAngle += Math.sin(frameCount * 0.012) * 0.015;
            desiredAngle = wanderAngle;
            humpClock += 1;
        } else {
            wanderAngle += Math.sin(frameCount * 0.008) * 0.012;
            desiredAngle = wanderAngle;
            if (headX < 50) wanderAngle = 0;
            if (headX > canvas.width - 50) wanderAngle = Math.PI;
            if (headY < 50) wanderAngle = Math.PI / 2;
            if (headY > canvas.height - 50) wanderAngle = -Math.PI / 2;
            humpClock += 1;
        }

        // Smooth turn
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (angleDiff > MAX_TURN_RATE) angleDiff = MAX_TURN_RATE;
        if (angleDiff < -MAX_TURN_RATE) angleDiff = -MAX_TURN_RATE;
        currentAngle += angleDiff;

        const wobbleAngle = currentAngle + Math.sin(frameCount * 0.03) * WOBBLE;
        const newX = headX + Math.cos(wobbleAngle) * SPEED;
        const newY = headY + Math.sin(wobbleAngle) * SPEED;

        trailHead = (trailHead + 1) % trail.length;
        trail[trailHead] = { x: newX, y: newY, angle: currentAngle };

        drawSegments();
    }

    function drawSegments() {
        for (let i = segments.length - 1; i >= 0; i--) {
            const seg = segments[i];
            let idx = trailHead - seg.trailOffset;
            if (idx < 0) idx += trail.length;
            const pos = trail[idx];
            if (!pos) continue;

            const wavePhase = seg.segIndex * HUMP_FREQUENCY - humpClock * HUMP_SPEED;
            const humpValue = Math.sin(wavePhase);

            const perpAngle = pos.angle + Math.PI / 2;
            const humpX = Math.cos(perpAngle) * humpValue * HUMP_AMPLITUDE;
            const humpY = Math.sin(perpAngle) * humpValue * HUMP_AMPLITUDE;

            const t = seg.segIndex / (totalSegs - 1);
            const taperScale = 1 - Math.pow(t, 2.5) * 0.4;

            const bulgePhase = seg.segIndex * Math.PI * 2 - humpClock * HUMP_SPEED * 2;
            const bulgeValue = (Math.sin(bulgePhase) + 1) * 0.5;
            const bulgeScale = 1 + bulgeValue * SEGMENT_BULGE;

            let segScale, humpMult;
            if (seg.type === 'head') {
                segScale = SCALE * 1.15;
                humpMult = 0;
            } else if (seg.type === 'tail') {
                segScale = SCALE * taperScale * bulgeScale * 0.8 + Math.abs(humpValue) * HUMP_SCALE_BOOST;
                humpMult = 0.4;
            } else {
                segScale = SCALE * taperScale * bulgeScale + Math.abs(humpValue) * HUMP_SCALE_BOOST;
                humpMult = Math.min(1, seg.segIndex / 4);
            }

            ctx.save();
            ctx.translate(pos.x + humpX * humpMult, pos.y + humpY * humpMult);
            ctx.rotate(pos.angle + Math.PI);
            ctx.scale(segScale, segScale);

            const w = seg.img.naturalWidth || seg.img.width;
            const h = seg.img.naturalHeight || seg.img.height;
            ctx.drawImage(seg.img, -w / 2, -h / 2, w, h);
            ctx.restore();
        }
    }

    function cleanup() {
        killed = true;
        if (animId) cancelAnimationFrame(animId);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseleave', onMouseLeave);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        activeCaterpillar = null;
    }

    // Start animation
    animId = requestAnimationFrame(tick);

    const instance = {
        drop() {
            if (killed || exiting) return;

            if (!settled) {
                // Still walking — just clean up after panel slides away
                setTimeout(cleanup, 600);
                return;
            }

            // Settled — stay in place, then crawl off after 1s
            const hx = trail[trailHead].x;
            const hy = trail[trailHead].y;
            const dL = hx, dR = canvas.width - hx;
            const dT = hy, dB = canvas.height - hy;
            const minD = Math.min(dL, dR, dT, dB);
            if (minD === dL) exitAngle = Math.PI;
            else if (minD === dR) exitAngle = 0;
            else if (minD === dT) exitAngle = -Math.PI / 2;
            else exitAngle = Math.PI / 2;
            exitAngle += (Math.random() - 0.5) * 0.6;

            setTimeout(() => {
                if (killed) return;
                settled = false;
                exiting = true;
            }, 1000);
        },
        _kill: cleanup
    };

    activeCaterpillar = instance;
    return instance;
}