// CaterpillarAnimator.js
// Add to projectpage.html: <script src="../../CaterpillarAnimator.js"></script>
// Assets: assets/caterpillar/head.png, body.png, tail.png

(function () {
    // Derive asset path from this script's own location (works at any page depth)
    const SCRIPT_DIR = document.currentScript.src.substring(0, document.currentScript.src.lastIndexOf('/') + 1);
    const ASSET_PATH = SCRIPT_DIR + 'assets/caterpillar/';
    const SEGMENT_COUNT_MIN = 9;
    const SEGMENT_COUNT_MAX = 12;
    const SEGMENT_SPACING = 18;      // visible gaps between segments
    const SPEED = 0.45;              // pixels per frame
    const SCALE = 0.08;              // bigger, more visible
    const SPAWN_DELAY = 200;        // ms before caterpillar appears
    const MAX_TURN_RATE = 0.018;     // max radians per frame — prevents body breaks

    // Hump wave parameters
    const HUMP_AMPLITUDE = 3;        // visible perpendicular displacement
    const HUMP_FREQUENCY = 0.5;      // wave tightness along the body
    const HUMP_SPEED = 0.04;         // hump rhythm
    const HUMP_SCALE_BOOST = 0.015;  // scale pulse

    // Body shape
    const TAPER = 0.05;              // each segment shrinks by this toward the tail
    const SEGMENT_BULGE = 0.06;      // per-segment scale pulse (makes segments look rounded)

    // Gentle path wobble
    const WOBBLE = 0.012;

    // Mouse following
    const MOUSE_DELAY = 60;          // frames of delay before following mouse
    const MOUSE_STOP_RADIUS = 150;   // px — stop and look when mouse is this close
    const MOUSE_TURN_RATE = 0.015;   // slow turn toward mouse when stopped

    let canvas, ctx;
    let headImg, bodyImg, tailImg;
    let loaded = false;
    let segments = [];
    let trail = [];
    let trailHead = 0;
    let frameCount = 0;
    let currentAngle = 0;
    let mouseX = -1000, mouseY = -1000;
    let mouseHistory = [];
    let wanderAngle = 0;
    let distanceTraveled = 0;
    let humpClock = 0;               // advances slower near mouse

    // ── Setup ────────────────────────────────────────────────────────
    function init() {
        canvas = document.createElement('canvas');
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9000;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);

        // Track mouse position
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        document.addEventListener('mouseleave', () => {
            mouseX = -1000;
            mouseY = -1000;
        });

        let loadCount = 0;
        const onLoad = () => { if (++loadCount === 3) start(); };

        headImg = new Image();
        headImg.onload = onLoad;
        headImg.onerror = () => console.warn('Caterpillar: missing head.png');
        headImg.src = ASSET_PATH + 'head.png';

        bodyImg = new Image();
        bodyImg.onload = onLoad;
        bodyImg.onerror = () => console.warn('Caterpillar: missing body.png');
        bodyImg.src = ASSET_PATH + 'body.png';

        tailImg = new Image();
        tailImg.onload = onLoad;
        tailImg.onerror = () => console.warn('Caterpillar: missing tail.png');
        tailImg.src = ASSET_PATH + 'tail.png';
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // ── Start after images load ──────────────────────────────────────
    function start() {
        loaded = true;
        const segCount = SEGMENT_COUNT_MIN + Math.floor(Math.random() * (SEGMENT_COUNT_MAX - SEGMENT_COUNT_MIN + 1));

        const trailSize = (segCount + 4) * SEGMENT_SPACING + 200;
        trail = new Array(trailSize);

        const spawn = randomEdgePoint();
        for (let i = 0; i < trailSize; i++) {
            trail[i] = { x: spawn.x, y: spawn.y, angle: 0 };
        }
        trailHead = trailSize - 1;

        // Head + body segments + tail (tail gets extra spacing to avoid overlap)
        segments = [];
        segments.push({ type: 'head', img: headImg, trailOffset: 0, segIndex: 0 });
        for (let i = 1; i <= segCount; i++) {
            // First segment sits tight against the head, rest are evenly spaced
            const offset = (i === 1) ? Math.floor(SEGMENT_SPACING * 0.25) : i * SEGMENT_SPACING;
            segments.push({ type: 'body', img: bodyImg, trailOffset: offset, segIndex: i });
        }
        segments.push({ type: 'tail', img: tailImg, trailOffset: (segCount + 1) * SEGMENT_SPACING + 4, segIndex: segCount + 1 });

        // Init mouse history buffer
        mouseHistory = [];
        for (let i = 0; i < MOUSE_DELAY + 10; i++) {
            mouseHistory.push({ x: spawn.x, y: spawn.y });
        }

        currentAngle = Math.random() * Math.PI * 2;
        wanderAngle = currentAngle;

        setTimeout(() => requestAnimationFrame(tick), SPAWN_DELAY);
    }

    // ── Animation loop ───────────────────────────────────────────────
    function tick() {
        if (!loaded) return;
        frameCount++;

        // Record mouse position into history buffer
        mouseHistory.push({ x: mouseX, y: mouseY });
        if (mouseHistory.length > MOUSE_DELAY + 10) mouseHistory.shift();

        const delayIdx = Math.max(0, mouseHistory.length - MOUSE_DELAY);
        const delayedMouse = mouseHistory[delayIdx];

        const headX = trail[trailHead].x;
        const headY = trail[trailHead].y;

        const distToMouse = Math.sqrt((mouseX - headX) ** 2 + (mouseY - headY) ** 2);
        const mouseOnScreen = mouseX > -500 && mouseY > -500;

        let moveSpeed = SPEED;
        let turnRate = MAX_TURN_RATE;
        let desiredAngle;

        if (mouseOnScreen && distToMouse < MOUSE_STOP_RADIUS) {
            // Near mouse — curl: gentle arc toward mouse
            moveSpeed = SPEED;
            turnRate = 0.025;
            desiredAngle = Math.atan2(mouseY - headY, mouseX - headX);
            humpClock += 0.15;
        } else if (mouseOnScreen) {
            // Meander toward delayed mouse — wander with a bias toward it
            const dxTarget = delayedMouse.x - headX;
            const dyTarget = delayedMouse.y - headY;
            const mouseAngle = Math.atan2(dyTarget, dxTarget);

            // Drift the wander angle slowly toward the mouse direction
            let drift = mouseAngle - wanderAngle;
            while (drift > Math.PI) drift -= Math.PI * 2;
            while (drift < -Math.PI) drift += Math.PI * 2;
            wanderAngle += drift * 0.02;
            // Smooth sine meander instead of random jitter
            wanderAngle += Math.sin(frameCount * 0.012) * 0.015;

            desiredAngle = wanderAngle;
            humpClock += 1;
        } else {
            // Wander when mouse is off-screen
            wanderAngle += Math.sin(frameCount * 0.008) * 0.012;
            desiredAngle = wanderAngle;
            if (headX < 50) wanderAngle = 0;
            if (headX > canvas.width - 50) wanderAngle = Math.PI;
            if (headY < 50) wanderAngle = Math.PI / 2;
            if (headY > canvas.height - 50) wanderAngle = -Math.PI / 2;
            humpClock += 1;           // normal hump speed
        }

        // Smooth turn with rate limiting
        let angleDiff = desiredAngle - currentAngle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        if (angleDiff > turnRate) angleDiff = turnRate;
        if (angleDiff < -turnRate) angleDiff = -turnRate;
        currentAngle += angleDiff;

        // Always move (even when curled, just slower) — keeps hump alive
        const wobbleAngle = currentAngle + Math.sin(frameCount * 0.03) * WOBBLE;
        const newX = headX + Math.cos(wobbleAngle) * moveSpeed;
        const newY = headY + Math.sin(wobbleAngle) * moveSpeed;

        distanceTraveled += moveSpeed;

        trailHead = (trailHead + 1) % trail.length;
        trail[trailHead] = { x: newX, y: newY, angle: currentAngle };

        // Draw
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const totalSegs = segments.length;

        // Draw back-to-front (tail first, head last)
        for (let i = totalSegs - 1; i >= 0; i--) {
            const seg = segments[i];
            const trailIdx = getTrailIndex(seg.trailOffset);
            const pos = trail[trailIdx];
            if (!pos) continue;

            // Hump wave traveling from tail to head
            const wavePhase = seg.segIndex * HUMP_FREQUENCY - humpClock * HUMP_SPEED;
            const humpValue = Math.sin(wavePhase);

            // Perpendicular offset (hump displacement)
            const perpAngle = pos.angle + Math.PI / 2;
            const humpX = Math.cos(perpAngle) * humpValue * HUMP_AMPLITUDE;
            const humpY = Math.sin(perpAngle) * humpValue * HUMP_AMPLITUDE;

            // Taper: gradual at first, steep right before the tail
            const t = seg.segIndex / (totalSegs - 1);
            const taperScale = 1 - Math.pow(t, 2.5) * 0.4;

            // Per-segment bulge
            const bulgePhase = seg.segIndex * Math.PI * 2 - humpClock * HUMP_SPEED * 2;
            const bulgeValue = (Math.sin(bulgePhase) + 1) * 0.5;
            const bulgeScale = 1 + bulgeValue * SEGMENT_BULGE;

            // Combined scale — head gets no hump/bulge effects
            let segScale, humpMult;
            if (seg.type === 'head') {
                segScale = SCALE * 1.15;
                humpMult = 0;
            } else if (seg.type === 'tail') {
                const scaleBoost = Math.abs(humpValue) * HUMP_SCALE_BOOST;
                segScale = SCALE * taperScale * bulgeScale * 0.8 + scaleBoost;
                humpMult = 0.4;
            } else {
                const scaleBoost = Math.abs(humpValue) * HUMP_SCALE_BOOST;
                segScale = SCALE * taperScale * bulgeScale + scaleBoost;
                // Ramp hump from 0 near head to 1 over first 4 segments
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

        requestAnimationFrame(tick);
    }

    function getTrailIndex(offset) {
        let idx = trailHead - offset;
        if (idx < 0) idx += trail.length;
        return idx;
    }

    // ── Path building ────────────────────────────────────────────────
    function buildPath(startX, startY) {
        const points = [];
        const w = canvas.width;
        const h = canvas.height;

        // 5-8 random waypoints across the screen
        const count = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < count; i++) {
            const pad = 100;
            const px = pad + Math.random() * (w - pad * 2);
            const py = pad + Math.random() * (h - pad * 2);
            points.push({ x: px, y: py });
        }

        // Exit off a random edge, re-enter from another
        points.push(randomEdgePoint());
        points.push(randomEdgePoint());

        return points;
    }

    function randomEdgePoint() {
        const w = canvas.width;
        const h = canvas.height;
        const edge = Math.floor(Math.random() * 4);
        const off = -60;
        switch (edge) {
            case 0: return { x: Math.random() * w, y: off };
            case 1: return { x: w - off, y: Math.random() * h };
            case 2: return { x: Math.random() * w, y: h - off };
            case 3: return { x: off, y: Math.random() * h };
        }
    }

    // ── Boot ─────────────────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();