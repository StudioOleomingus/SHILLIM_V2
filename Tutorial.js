// Tutorial.js — Floating tutorial overlay for Shillim Interactive Archive
// Shows a sequence of instructional messages as the user interacts with the canvas.

const TUTORIAL_MESSAGES = [
    {
        id: 'welcome',
        text: 'Welcome to the Interactive Archive for Shillim.\nClick to continue or press Esc to skip the tutorial.',
        trigger: 'auto',       // shows immediately
        advance: 'click'       // advances on click
    },
    {
        id: 'select',
        text: 'Start by selecting a portion of space in the box above to create a pattern. Click and drag to make your selection.',
        trigger: 'auto',       // shows after welcome is dismissed
        advance: 'drag'        // advances when user completes a drag
    },
    {
        id: 'enclose',
        text: 'Great! Now try to create enclosed spaces to form empty pockets surrounded by textures.',
        trigger: 'afterDrag',  // shows right after first drag
        advance: 'surround'   // advances when first surrounded group detected
    },
    {
        id: 'firstEnclosed',
        text: 'Excellent! You\'ve created your first enclosed space. Try creating more to reveal projects from the archive.',
        trigger: 'afterSurround',
        advance: 'click'
    },
    {
        id: 'direction',
        text: 'Notice how the direction you select creates a different texture. Each texture corresponds to a category of project in the archive — plan your compositions to explore different kinds of projects.',
        trigger: 'auto',
        advance: 'click'
    }
];

let currentStep = 0;
let tutorialActive = false;
let tutorialSkipped = false;
let overlayEl = null;
let boxEl = null;
let textEl = null;
let hintEl = null;

// Callbacks that ImageSection will invoke
let onDragComplete = null;
let onSurroundDetected = null;

function createOverlay() {
    // Outer overlay – covers the whole viewport, pointer-events only on the box itself
    overlayEl = document.createElement('div');
    overlayEl.id = 'tutorial-overlay';

    boxEl = document.createElement('div');
    boxEl.id = 'tutorial-box';

    textEl = document.createElement('p');
    textEl.id = 'tutorial-text';

    hintEl = document.createElement('span');
    hintEl.id = 'tutorial-hint';

    boxEl.appendChild(textEl);
    boxEl.appendChild(hintEl);
    overlayEl.appendChild(boxEl);
    document.body.appendChild(overlayEl);
}

function showStep(index) {
    if (tutorialSkipped || index >= TUTORIAL_MESSAGES.length) {
        endTutorial();
        return;
    }

    currentStep = index;
    const msg = TUTORIAL_MESSAGES[index];

    textEl.textContent = msg.text;

    // Hint text
    if (msg.advance === 'click') {
        hintEl.textContent = 'Click this box to continue';
        hintEl.style.display = 'block';
    } else if (msg.advance === 'drag') {
        hintEl.textContent = '';
        hintEl.style.display = 'none';
    } else if (msg.advance === 'surround') {
        hintEl.textContent = '';
        hintEl.style.display = 'none';
    } else {
        hintEl.textContent = '';
        hintEl.style.display = 'none';
    }

    // Animate in
    overlayEl.style.display = 'flex';
    boxEl.style.opacity = '0';
    boxEl.style.transform = 'translateY(12px)';
    requestAnimationFrame(() => {
        boxEl.style.opacity = '1';
        boxEl.style.transform = 'translateY(0)';
    });

    // Bind advance behaviour
    setupAdvance(msg.advance);
}

function setupAdvance(advanceType) {
    // Remove old listeners
    overlayEl.removeEventListener('click', handleClickAdvance);

    if (advanceType === 'click') {
        overlayEl.addEventListener('click', handleClickAdvance);
    }
    // 'drag' and 'surround' are advanced externally via tutorialDragDone / tutorialSurroundDone
}

function handleClickAdvance() {
    overlayEl.removeEventListener('click', handleClickAdvance);
    advanceToNext();
}

function advanceToNext() {
    if (tutorialSkipped) return;

    const nextIndex = currentStep + 1;

    // Animate out then show next
    boxEl.style.opacity = '0';
    boxEl.style.transform = 'translateY(8px)';
    setTimeout(() => {
        showStep(nextIndex);
    }, 300);
}

function endTutorial() {
    tutorialActive = false;
    tutorialSkipped = true;
    try { sessionStorage.setItem('shillim-tutorial-done', '1'); } catch(e) {}
    if (overlayEl) {
        boxEl.style.opacity = '0';
        boxEl.style.transform = 'translateY(8px)';
        setTimeout(() => {
            overlayEl.style.display = 'none';
        }, 300);
    }
    // Clean up Esc listener
    window.removeEventListener('keydown', handleEsc);
}

function handleEsc(e) {
    if (e.key === 'Escape') {
        endTutorial();
    }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Call once after initInfoSection / initImageSection / initBottomLayout */
function startTutorial() {
    // Check if user has already seen it (persisted per-session in sessionStorage)
    if (sessionStorage.getItem('shillim-tutorial-done')) {
        tutorialSkipped = true;
        return;
    }

    tutorialActive = true;
    tutorialSkipped = false;
    currentStep = 0;

    createOverlay();
    window.addEventListener('keydown', handleEsc);
    showStep(0);
}

/** Called by ImageSection when a drag-to-paint is completed */
function tutorialDragDone() {
    if (!tutorialActive || tutorialSkipped) return;
    if (currentStep === 1 && TUTORIAL_MESSAGES[1].advance === 'drag') {
        advanceToNext();
    }
}

/** Called by ImageSection when a new surrounded group is detected */
function tutorialSurroundDone() {
    if (!tutorialActive || tutorialSkipped) return;
    if (currentStep === 2 && TUTORIAL_MESSAGES[2].advance === 'surround') {
        advanceToNext();
    }
}

/** Is the tutorial currently blocking interaction? (for step 0 only) */
function isTutorialBlocking() {
    return tutorialActive && !tutorialSkipped && currentStep === 0;
}

export { startTutorial, tutorialDragDone, tutorialSurroundDone, isTutorialBlocking };
