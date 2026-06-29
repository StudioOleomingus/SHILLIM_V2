// Transitions.js
// Shared cascade motions for PixiJS containers.
// power4.out ≈ cubic-bezier(0.22, 1, 0.36, 1) (ease-out-quint)

const EASE_OUT = 'power4.out';
const EASE_IN = 'power3.in';
const DURATION = 0.55;
const DEFAULT_OFFSET = 140;

// ── Slide from RIGHT ─────────────────────────────────────────────────
function slideInFromRight(target, opts = {}) {
    const { offset = DEFAULT_OFFSET, duration = DURATION, ease = EASE_OUT, fade = true, onComplete } = opts;
    if (target.__restX === undefined) target.__restX = target.x;
    const restX = target.__restX;

    if (typeof gsap === 'undefined') {
        target.x = restX; target.alpha = 1; target.visible = true;
        if (onComplete) onComplete(); return;
    }

    gsap.killTweensOf(target);
    target.visible = true;
    target.x = restX + offset;
    if (fade) target.alpha = 0;
    gsap.to(target, { x: restX, duration, ease, onComplete });
    if (fade) gsap.to(target, { alpha: 1, duration: duration * 0.75, ease: 'power2.out' });
}

function slideOutToRight(target, opts = {}) {
    const { offset = DEFAULT_OFFSET, duration = 0.4, ease = EASE_IN, fade = true, onComplete } = opts;
    const restX = target.__restX !== undefined ? target.__restX : target.x;

    const finish = () => {
        target.visible = false; target.x = restX;
        if (fade) target.alpha = 1;
        if (onComplete) onComplete();
    };

    if (typeof gsap === 'undefined') { finish(); return; }

    gsap.killTweensOf(target);
    gsap.to(target, { x: restX + offset, duration, ease, onComplete: finish });
    if (fade) gsap.to(target, { alpha: 0, duration, ease });
}

// ── Slide from LEFT (drawer style — no fade, card is solid behind sidebar) ──
function slideInFromLeft(target, opts = {}) {
    const { offset = DEFAULT_OFFSET, duration = 0.9, ease = EASE_OUT, fade = false, onComplete } = opts;
    if (target.__restX === undefined) target.__restX = target.x;
    const restX = target.__restX;

    if (typeof gsap === 'undefined') {
        target.x = restX; target.alpha = 1; target.visible = true;
        if (onComplete) onComplete(); return;
    }

    gsap.killTweensOf(target);
    target.visible = true;
    target.alpha = 1;
    target.x = restX - offset;
    gsap.to(target, { x: restX, duration, ease, onComplete });
}

function slideOutToLeft(target, opts = {}) {
    const { offset = DEFAULT_OFFSET, duration = 0.55, ease = 'power2.inOut', fade = false, onComplete } = opts;
    const restX = target.__restX !== undefined ? target.__restX : target.x;

    const finish = () => {
        target.visible = false;
        target.x = restX;
        target.alpha = 1;
        if (onComplete) onComplete();
    };

    if (typeof gsap === 'undefined') { finish(); return; }

    gsap.killTweensOf(target);
    gsap.to(target, { x: restX - offset, duration, ease, onComplete: finish });
}

// ── Page-level slide ─────────────────────────────────────────────────
function slidePageInFromRight(target, distance, opts = {}) {
    const { duration = 0.7, ease = EASE_OUT, onComplete } = opts;
    if (typeof gsap === 'undefined') {
        target.x = 0; if (onComplete) onComplete(); return;
    }
    gsap.killTweensOf(target);
    target.x = distance;
    gsap.to(target, { x: 0, duration, ease, onComplete });
}

export { slideInFromRight, slideOutToRight, slideInFromLeft, slideOutToLeft, slidePageInFromRight, EASE_OUT, EASE_IN, DURATION };