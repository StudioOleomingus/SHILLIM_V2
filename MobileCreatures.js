/* ==========================================================================
   MobileCreatures.js
   Lightweight, self-contained creature spawner for the small-screen redirect
   overlay (.mobile-redirect). Tapping/clicking anywhere on the card — except
   the "Browse the Archive" button — spawns one of the creatures from the game
   page (ants, a beetle, or the lizard). Each meanders for a bit then crawls
   off the edge of the screen and is cleaned up.

   No PixiJS dependency: this draws the same frame PNGs onto a plain 2D canvas
   via requestAnimationFrame, so it runs even though the Pixi app is hidden on
   small screens. Movement, paths and orientation mirror LizardAnimator.js.
   ========================================================================== */
(function () {
    'use strict';

    // ── Creature definitions (mirrors the game's CreatureAnimator) ──────────
    // `height` is the on-screen draw height in CSS px (the source art is tall),
    // `fps` how fast the walk cycle plays, `speed` travel in px per second.
    const CREATURES = [
        { name: 'ant',    folder: 'assets/ant/',    frameCount: 12, height: 38,  fps: 15, speed: 120, spawnCount: [3, 6], weight: 5, path: antPath },
        { name: 'beetle', folder: 'assets/beetle/', frameCount: 11, height: 64,  fps: 12, speed: 80,  spawnCount: [1, 1], weight: 2, path: beetlePath },
        { name: 'lizard', folder: 'assets/lizard/', frameCount: 11, height: 120, fps: 8,  speed: 100, spawnCount: [1, 1], weight: 1, path: lizardPath },
    ];

    const frameCache = {};   // name -> [HTMLImageElement]
    const creatures = [];    // active sprites
    let canvas, ctx, overlay;
    let running = false;
    let lastTs = 0;

    // ── Boot ────────────────────────────────────────────────────────────────
    function init() {
        overlay = document.querySelector('.mobile-redirect');
        canvas = document.querySelector('.mobile-redirect__canvas');
        if (!overlay || !canvas) return;
        ctx = canvas.getContext('2d');

        resize();
        window.addEventListener('resize', resize);

        preload();

        // Spawn on click anywhere on the overlay except on the link/button.
        overlay.addEventListener('pointerdown', function (e) {
            if (e.target.closest('a')) return;   // let the button do its job
            spawn(e.clientX, e.clientY);
        });
    }

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(window.innerWidth * dpr);
        canvas.height = Math.floor(window.innerHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function preload() {
        CREATURES.forEach(function (c) {
            const frames = [];
            for (let i = 0; i < c.frameCount; i++) {
                const img = new Image();
                img.src = c.folder + i + '.png';
                frames.push(img);
            }
            frameCache[c.name] = frames;
        });
    }

    // ── Spawning ──────────────────────────────────────────────────────────────
    function spawn(x, y) {
        const def = pickCreature();
        const frames = frameCache[def.name];
        if (!frames) return;

        const exitAngle = outwardAngle(x, y);
        const [minC, maxC] = def.spawnCount;
        const count = minC + Math.floor(Math.random() * (maxC - minC + 1));

        for (let i = 0; i < count; i++) {
            const ox = count > 1 ? (Math.random() - 0.5) * 28 : 0;
            const oy = count > 1 ? (Math.random() - 0.5) * 28 : 0;
            const delay = count > 1 ? i * (70 + Math.random() * 110) : 0;
            setTimeout(function () {
                addCreature(def, frames, x + ox, y + oy, exitAngle);
            }, delay);
        }
        start();
    }

    function addCreature(def, frames, x, y, exitAngle) {
        const ratio = frames[0].naturalWidth && frames[0].naturalHeight
            ? frames[0].naturalWidth / frames[0].naturalHeight
            : 0.5;
        const waypoints = def.path(x, y, exitAngle);
        creatures.push({
            def: def,
            frames: frames,
            x: x, y: y,
            drawH: def.height,
            drawW: def.height * ratio,
            waypoints: waypoints,
            wp: 0,
            angle: angleTo(x, y, waypoints[0].x, waypoints[0].y),
            frame: 0,
            frameTimer: 0,
        });
        start();   // creatures are added asynchronously (setTimeout), so (re)start here
    }

    // ── Main loop ──────────────────────────────────────────────────────────
    function start() {
        if (running) return;
        running = true;
        lastTs = performance.now();
        requestAnimationFrame(tick);
    }

    function tick(ts) {
        const dt = Math.min((ts - lastTs) / 1000, 0.05);  // clamp to avoid jumps
        lastTs = ts;

        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        for (let i = creatures.length - 1; i >= 0; i--) {
            if (!updateCreature(creatures[i], dt)) {
                creatures.splice(i, 1);
                continue;
            }
            drawCreature(creatures[i]);
        }

        if (creatures.length > 0) {
            requestAnimationFrame(tick);
        } else {
            running = false;
        }
    }

    function updateCreature(c, dt) {
        // Advance the walk-cycle frame.
        c.frameTimer += dt;
        const frameDur = 1 / c.def.fps;
        while (c.frameTimer >= frameDur) {
            c.frameTimer -= frameDur;
            c.frame = (c.frame + 1) % c.frames.length;
        }

        // Move toward the current waypoint.
        let dist = c.def.speed * dt;
        while (dist > 0 && c.wp < c.waypoints.length) {
            const t = c.waypoints[c.wp];
            const dx = t.x - c.x;
            const dy = t.y - c.y;
            const d = Math.hypot(dx, dy);
            if (d <= dist) {
                c.x = t.x; c.y = t.y;
                dist -= d;
                c.wp++;
                const next = c.waypoints[c.wp];
                if (next) c.angle = angleTo(c.x, c.y, next.x, next.y);
            } else {
                c.x += (dx / d) * dist;
                c.y += (dy / d) * dist;
                c.angle = angleTo(c.x, c.y, t.x, t.y);
                dist = 0;
            }
        }

        // Remove once it has wandered off the screen.
        const m = 160;
        if (c.wp >= c.waypoints.length ||
            c.x < -m || c.x > window.innerWidth + m ||
            c.y < -m || c.y > window.innerHeight + m) {
            return false;
        }
        return true;
    }

    function drawCreature(c) {
        const img = c.frames[c.frame];
        if (!img || !img.complete || !img.naturalWidth) return;
        ctx.save();
        ctx.translate(c.x, c.y);
        // Frames naturally point "up"; rotate so they face their travel
        // direction (same convention as the game: angle + 90°).
        ctx.rotate(c.angle + Math.PI / 2);
        ctx.drawImage(img, -c.drawW / 2, -c.drawH / 2, c.drawW, c.drawH);
        ctx.restore();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PATH BUILDERS (ported from LizardAnimator.js)
    // ═══════════════════════════════════════════════════════════════════════
    function antPath(startX, startY, exitAngle) {
        const points = [];
        let x = startX, y = startY;

        const scatter = exitAngle + Math.PI * (0.3 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
        let angle = scatter;

        for (let i = 0; i < 3; i++) {
            const len = 10 + Math.random() * 15;
            const jitter = (Math.random() - 0.5) * 0.3;
            x += Math.cos(angle + jitter) * len;
            y += Math.sin(angle + jitter) * len;
            points.push({ x: x, y: y });
        }

        const wander = 10 + Math.floor(Math.random() * 6);
        for (let i = 0; i < wander; i++) {
            angle += (Math.random() - 0.5) * 0.6 * 0.3;
            const len = 12 + Math.random() * 18;
            x += Math.cos(angle) * len;
            y += Math.sin(angle) * len;
            points.push({ x: x, y: y });
        }

        const diff = normalize(exitAngle - angle);
        for (let i = 1; i <= 5; i++) {
            angle += diff * (i / 5) * 0.35;
            const len = 14 + Math.random() * 16;
            x += Math.cos(angle) * len;
            y += Math.sin(angle) * len;
            points.push({ x: x, y: y });
        }

        points.push({ x: x + Math.cos(exitAngle) * 600, y: y + Math.sin(exitAngle) * 600 });
        return points;
    }

    function beetlePath(startX, startY, exitAngle) {
        const points = [];
        let x = startX, y = startY;
        const curve = (Math.random() < 0.5 ? 1 : -1) * (0.04 + Math.random() * 0.06);
        let angle = exitAngle;

        for (let i = 0; i < 6; i++) {
            const len = 50 + Math.random() * 40;
            angle += curve;
            x += Math.cos(angle) * len;
            y += Math.sin(angle) * len;
            points.push({ x: x, y: y });
        }
        points.push({ x: x + Math.cos(angle) * 600, y: y + Math.sin(angle) * 600 });
        return points;
    }

    function lizardPath(startX, startY, exitAngle) {
        // A couple of gentle bends, then off the screen.
        const points = [];
        let x = startX, y = startY;
        let angle = exitAngle;
        for (let i = 0; i < 3; i++) {
            angle += (Math.random() - 0.5) * 0.5;
            const len = 90 + Math.random() * 70;
            x += Math.cos(angle) * len;
            y += Math.sin(angle) * len;
            points.push({ x: x, y: y });
        }
        points.push({ x: x + Math.cos(exitAngle) * 700, y: y + Math.sin(exitAngle) * 700 });
        return points;
    }

    // ── Helpers ──────────────────────────────────────────────────────────────
    function pickCreature() {
        const total = CREATURES.reduce(function (s, c) { return s + c.weight; }, 0);
        let r = Math.random() * total;
        for (const c of CREATURES) {
            if ((r -= c.weight) <= 0) return c;
        }
        return CREATURES[0];
    }

    // Head outward toward whichever screen edge is nearest, with some spread.
    function outwardAngle(x, y) {
        const w = window.innerWidth, h = window.innerHeight;
        const dl = x, dr = w - x, dt = y, db = h - y;
        const min = Math.min(dl, dr, dt, db);
        let base;
        if (min === dl) base = Math.PI;
        else if (min === dr) base = 0;
        else if (min === dt) base = -Math.PI / 2;
        else base = Math.PI / 2;
        return base + (Math.random() - 0.5) * (Math.PI / 2);
    }

    function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
    function normalize(a) {
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        return a;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
