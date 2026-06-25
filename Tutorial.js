// Tutorial.js — Floating tutorial overlay for Shillim Interactive Archive
// Shows a sequence of instructional messages with optional GIF demonstrations.

const TUTORIAL_MESSAGES = [
    {
        id: 'welcome',
        text: 'Welcome to the Interactive Archive for Shillim.\nClick to continue or press Esc to skip the tutorial.',
        advance: 'click',
        gif: null
    },
    {
        id: 'category',
        text: 'Start by choosing a category from the palette below. Each colour represents a different type of project in the archive.',
        advance: 'click',
        gif: 'assets/tutorial/pick-category.gif'
    },
    {
        id: 'select',
        text: 'Click and drag on the canvas to paint with the selected texture.',
        advance: 'drag',
        gif: 'assets/tutorial/drag-paint.gif'
    },
    {
        id: 'enclose',
        text: 'Try creating enclosed spaces — surround empty cells with texture to reveal projects.',
        advance: 'surround',
        gif: 'assets/tutorial/enclose.gif'
    },
    {
        id: 'firstEnclosed',
        text: 'Excellent! You\'ve created your first enclosed space. Try creating more to reveal projects from the archive.',
        advance: 'click',
        gif: null
    },
    {
        id: 'direction',
        text: 'Each category produces a different texture. Switch categories to explore more of the archive.',
        advance: 'click',
        gif: 'assets/tutorial/switch-category.gif'
    }
];

let currentStep = 0;
let tutorialActive = false;
let tutorialSkipped = false;
let overlayEl = null;
let boxEl = null;
let gifEl = null;
let textEl = null;
let hintEl = null;

function createOverlay() {
    overlayEl = document.createElement('div');
    overlayEl.id = 'tutorial-overlay';
    Object.assign(overlayEl.style, {
        position: 'fixed',
        top: '0', left: '0', width: '100%', height: '100%',
        display: 'none',
        alignItems: 'flex-end',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: '9999',
        background: 'none',
        padding: '0 0 140px 300px'  // left padding matches sidebar width, centers over play area
    });

    boxEl = document.createElement('div');
    boxEl.id = 'tutorial-box';
    Object.assign(boxEl.style, {
        pointerEvents: 'auto',
        background: 'rgba(255,255,255,0.96)',
        borderRadius: '12px',
        padding: '20px 30px 25px',
        maxWidth: '525px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        transition: 'opacity 0.3s, transform 0.3s',
        cursor: 'default',
        textAlign: 'center'
    });

    gifEl = document.createElement('img');
    gifEl.id = 'tutorial-gif';
    Object.assign(gifEl.style, {
        display: 'none',
        width: '100%',
        maxHeight: '225px',
        objectFit: 'contain',
        borderRadius: '8px',
        marginBottom: '12px',
        background: '#f5f5f5'
    });

    textEl = document.createElement('p');
    textEl.id = 'tutorial-text';
    Object.assign(textEl.style, {
        margin: '0 0 8px 0',
        fontFamily: 'Lucida Grande, sans-serif',
        fontSize: '19px',
        lineHeight: '1.5',
        color: '#333',
        whiteSpace: 'pre-line',
        textAlign: 'left'
    });

    hintEl = document.createElement('span');
    hintEl.id = 'tutorial-hint';
    Object.assign(hintEl.style, {
        fontFamily: 'Lucida Grande, sans-serif',
        fontSize: '15px',
        color: '#999',
        display: 'none'
    });

    boxEl.appendChild(gifEl);
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

    // GIF
    if (msg.gif) {
        gifEl.src = msg.gif;
        gifEl.style.display = 'block';
    } else {
        gifEl.src = '';
        gifEl.style.display = 'none';
    }

    textEl.textContent = msg.text;

    // Hint
    if (msg.advance === 'click') {
        hintEl.textContent = 'Click anywhere to continue';
        hintEl.style.display = 'block';
    } else if (msg.advance === 'drag') {
        hintEl.textContent = 'Try it — drag on the canvas above';
        hintEl.style.display = 'block';
    } else if (msg.advance === 'surround') {
        hintEl.textContent = 'Enclose some empty space to continue';
        hintEl.style.display = 'block';
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

    setupAdvance(msg.advance);
}

function setupAdvance(advanceType) {
    document.removeEventListener('pointerdown', handleClickAdvance);

    if (advanceType === 'click') {
        boxEl.style.cursor = 'pointer';
        document.addEventListener('pointerdown', handleClickAdvance);
    } else {
        boxEl.style.cursor = 'default';
    }
}

function handleClickAdvance() {
    document.removeEventListener('pointerdown', handleClickAdvance);
    advanceToNext();
}

function advanceToNext() {
    if (tutorialSkipped) return;

    const nextIndex = currentStep + 1;

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
    window.removeEventListener('keydown', handleEsc);
}

function handleEsc(e) {
    if (e.key === 'Escape') {
        endTutorial();
    }
}

// ── Public API ──────────────────────────────────────────────────────

function startTutorial() {
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

function tutorialDragDone() {
    if (!tutorialActive || tutorialSkipped) return;
    if (currentStep === 2 && TUTORIAL_MESSAGES[2].advance === 'drag') {
        advanceToNext();
    }
}

function tutorialSurroundDone() {
    if (!tutorialActive || tutorialSkipped) return;
    if (currentStep === 3 && TUTORIAL_MESSAGES[3].advance === 'surround') {
        advanceToNext();
    }
}

function isTutorialBlocking() {
    return tutorialActive && !tutorialSkipped && currentStep === 0;
}

export { startTutorial, tutorialDragDone, tutorialSurroundDone, isTutorialBlocking };