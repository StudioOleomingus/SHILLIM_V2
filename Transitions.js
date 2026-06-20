// Transitions.js
// Shared "cascade from the right" motion, mirroring the Archive Index panel's
// CSS transition (transform translateX + cubic-bezier(0.22, 1, 0.36, 1)).
// For PixiJS containers we approximate that easing with GSAP's power4.out
// (quintic ease-out) on the `x` property, plus an optional fade.

// power4.out ≈ cubic-bezier(0.22, 1, 0.36, 1) (ease-out-quint)
const EASE_OUT = 'power4.out';
const EASE_IN = 'power3.in';
const DURATION = 0.55;
const DEFAULT_OFFSET = 140; // how far off to the right the element starts

// Slide a PIXI display object in from the right to its resting x position.
// The resting x is captured the first time this runs (stored as __restX).
function slideInFromRight(target, opts = {}) {
    const {
        offset = DEFAULT_OFFSET,
        duration = DURATION,
        ease = EASE_OUT,
        fade = true,
        onComplete,
    } = opts;

    if (target.__restX === undefined) target.__restX = target.x;
    const restX = target.__restX;

    if (typeof gsap === 'undefined') {
        target.x = restX;
        target.alpha = 1;
        target.visible = true;
        if (onComplete) onComplete();
        return;
    }

    gsap.killTweensOf(target);
    target.visible = true;
    target.x = restX + offset;
    if (fade) target.alpha = 0;

    gsap.to(target, { x: restX, duration, ease, onComplete });
    if (fade) gsap.to(target, { alpha: 1, duration: duration * 0.75, ease: 'power2.out' });
}

// Slide a PIXI display object out to the right, then hide it and restore its
// resting x/alpha so the next slideInFromRight starts cleanly.
function slideOutToRight(target, opts = {}) {
    const {
        offset = DEFAULT_OFFSET,
        duration = 0.4,
        ease = EASE_IN,
        fade = true,
        onComplete,
    } = opts;

    const restX = target.__restX !== undefined ? target.__restX : target.x;

    const finish = () => {
        target.visible = false;
        target.x = restX;
        if (fade) target.alpha = 1;
        if (onComplete) onComplete();
    };

    if (typeof gsap === 'undefined') {
        finish();
        return;
    }

    gsap.killTweensOf(target);
    gsap.to(target, { x: restX + offset, duration, ease, onComplete: finish });
    if (fade) gsap.to(target, { alpha: 0, duration, ease });
}

// Page-level cascade: slide an always-visible container (e.g. the whole stage)
// in from a given distance to x = 0. Unlike the helpers above it never toggles
// visibility or alpha.
function slidePageInFromRight(target, distance, opts = {}) {
    const { duration = 0.7, ease = EASE_OUT, onComplete } = opts;

    if (typeof gsap === 'undefined') {
        target.x = 0;
        if (onComplete) onComplete();
        return;
    }

    gsap.killTweensOf(target);
    target.x = distance;
    gsap.to(target, { x: 0, duration, ease, onComplete });
}

export { slideInFromRight, slideOutToRight, slidePageInFromRight, EASE_OUT, EASE_IN, DURATION };
