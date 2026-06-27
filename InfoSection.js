import { app, projects, PLAIN_COLORS, stageHeight } from './Config.js';
import { createProjectCard } from './ProjectCard.js';
import { indexBg, whiteCircleBg } from './Resources.js';
import { openArchivePanel } from './ArchivePanel.js';

const container = document.getElementById('app-container');

let archiveIndexValueLabelText;
let viewportHeight = 900;

// ---- Help dialog (DOM overlay above the canvas) ----
let helpBackdropEl = null;
function buildHelpDialog() {
    if (helpBackdropEl) return;
    helpBackdropEl = document.createElement('div');
    helpBackdropEl.className = 'help-backdrop';

    const dialog = document.createElement('div');
    dialog.className = 'help-dialog';
    dialog.innerHTML = `
        <button class="help-close" title="Close">&times;</button>
        <h2>About the Shillim Archive</h2>
        <p>The Shillim Archive is an interactive repository of projects by the Shillim Institute. This digital ecosystem encompasses work ranging from art residencies and mapping workshops to ecological surveys and reforestation programs, as well as educational initiatives and community medical outreach. By providing a browser-based interactive site, the archive invites visitors to draw new associations between these varied works, situating each project within the specific landscape of the Northern Western Ghats from which it emerges.</p>
    `;
    helpBackdropEl.appendChild(dialog);
    container.appendChild(helpBackdropEl);

    helpBackdropEl.addEventListener('click', hideHelpDialog);
    dialog.addEventListener('click', (e) => e.stopPropagation());
    dialog.querySelector('.help-close').addEventListener('click', hideHelpDialog);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') hideHelpDialog();
    });
}
function showHelpDialog() {
    buildHelpDialog();
    helpBackdropEl.classList.add('open');
}
function hideHelpDialog() {
    if (helpBackdropEl) helpBackdropEl.classList.remove('open');
}

async function initInfoSection() {
    try {

        // The card list is clipped: it starts below the archive button and
        // ends the same distance from the bottom of the panel.
        const LIST_TOP = 100;
        const LIST_BOTTOM_MARGIN = 100;

        // Lay the scrollable card viewport out in the fixed 1650x1000 logical
        // space; CSS scales the canvas to the window, so we use the design
        // height (not the live, scaled container height).
        viewportHeight = stageHeight - LIST_TOP - LIST_BOTTOM_MARGIN;

        // Create a container for the image section
        const imageContainer = new PIXI.Container();
        imageContainer.x = 10;  // Position from left
        imageContainer.y = 10;    // Position from top
        imageContainer.eventMode = 'static';

        // Create a container for the background with effects
        const bgContainer = new PIXI.Container();

        //archiveIndex -- circular button (flat, no shadow) -----------------
        // Tucked into the top-left corner (imageContainer is offset +10,+10,
        // so this leaves ~14px from the canvas edges).
        const archiveBtnRadius = 30;
        const archiveIndexButton = new PIXI.Container();
        archiveIndexButton.x = 4 + archiveBtnRadius;
        archiveIndexButton.y = 4 + archiveBtnRadius;
        archiveIndexButton.eventMode = 'static';
        archiveIndexButton.cursor = 'pointer';
        archiveIndexButton.hitArea = new PIXI.Circle(0, 0, archiveBtnRadius);

        const archiveBtnBg = new PIXI.Graphics();
        archiveBtnBg.beginFill(0xffffff);
        archiveBtnBg.drawCircle(0, 0, archiveBtnRadius);
        archiveBtnBg.endFill();
        archiveIndexButton.addChild(archiveBtnBg);

        // Plus icon (PNG) inside the button.
        const archivePlus = PIXI.Sprite.from('assets/PLUS.png');
        archivePlus.anchor.set(0.5);
        archivePlus.scale.set(34 / 512);   // PLUS.png is 512x512
        archivePlus.eventMode = 'none';
        archiveIndexButton.addChild(archivePlus);

        // Count value is still tracked (updated elsewhere) but no longer shown.
        archiveIndexValueLabelText = new PIXI.Text('0', { fontFamily: 'Gelasio', fontSize: 22, fill: 0x808080 });
        archiveIndexValueLabelText.visible = false;
        archiveIndexValueLabelText.eventMode = 'none';

        // Hover label that reveals "Archive Index" to the right of the button.
        const archiveHoverLabel = new PIXI.Text('Archive Index', {
            fontFamily: 'Gelasio', fontStyle: 'italic', fontSize: 20, fill: 0x808080
        });
        archiveHoverLabel.anchor.set(0, 0.5);
        archiveHoverLabel.x = archiveIndexButton.x + archiveBtnRadius + 14;
        archiveHoverLabel.y = archiveIndexButton.y;
        archiveHoverLabel.eventMode = 'none';
        archiveHoverLabel.alpha = 0;

        archiveIndexButton.on('pointerover', () => {
            archiveBtnBg.tint = 0xf0f0f0;
            gsap.killTweensOf(archiveHoverLabel);
            gsap.to(archiveHoverLabel, { alpha: 1, duration: 0.2, ease: 'power2.out' });
        });
        archiveIndexButton.on('pointerout', () => {
            archiveBtnBg.tint = 0xffffff;
            gsap.killTweensOf(archiveHoverLabel);
            gsap.to(archiveHoverLabel, { alpha: 0, duration: 0.2, ease: 'power2.out' });
        });
        archiveIndexButton.on('pointerdown', () => {
            // Cascade the project index out from the right as an in-page panel.
            openArchivePanel();
        });

        bgContainer.addChild(archiveIndexButton);
        bgContainer.addChild(archiveHoverLabel);

        //help -- circular button at the bottom-left corner -----------------
        const helpBtnRadius = 30;
        const helpButton = new PIXI.Container();
        helpButton.x = 4 + helpBtnRadius;                              // mirror archive button (left margin)
        helpButton.y = stageHeight - 14 - helpBtnRadius - 10;          // ~14px from the bottom (imageContainer +10)
        helpButton.eventMode = 'static';
        helpButton.cursor = 'pointer';
        helpButton.hitArea = new PIXI.Circle(0, 0, helpBtnRadius);

        const helpBtnBg = new PIXI.Graphics();
        helpBtnBg.beginFill(0xffffff);
        helpBtnBg.drawCircle(0, 0, helpBtnRadius);
        helpBtnBg.endFill();
        helpButton.addChild(helpBtnBg);

        const helpMark = PIXI.Sprite.from('assets/HELP.png');
        helpMark.anchor.set(0.5);
        helpMark.scale.set(58 / 512);   // HELP.png is 512x512
        helpMark.y = 1;
        helpMark.eventMode = 'none';
        helpButton.addChild(helpMark);

        // Help button is pinned to the bottom of the fixed-size canvas; the CSS
        // scale keeps it correctly placed at any window size, so no resize
        // handler is needed.

        helpButton.on('pointerover', () => { helpBtnBg.tint = 0xf0f0f0; });
        helpButton.on('pointerout', () => { helpBtnBg.tint = 0xffffff; });
        helpButton.on('pointertap', () => { showHelpDialog(); });

        bgContainer.addChild(helpButton);

        // Create scrollable container
        const scrollContainer = new PIXI.Container();
        scrollContainer.x = 0;
        scrollContainer.y = LIST_TOP;
        scrollContainer.width = 300;
        scrollContainer.height = 900;
        scrollContainer.eventMode = 'static';

        // (No filled background here — the #ececec frame shows behind the white cards.)
        let currentY = 0;
        const cardSpacing = 10;
        let usedProjectIndices = new Set();

        // Function to clear all projects
        function clearAllProjects() {
            // Clear all project cards and their detail windows
            scrollContainer.children.forEach(card => {
                if (card.detailContainer) {
                    app.stage.removeChild(card.detailContainer);
                }
            });
            scrollContainer.removeChildren();
            usedProjectIndices.clear();
            currentY = 0;
            scrollContainer.y = LIST_TOP;
        }
        window.clearAllProjects = clearAllProjects;

        // Function to add a project based on percentages
        function addRandomProject(artPercent, communityPercent, ecologyPercent, researchPercent, healthPercent, educationPercent) {
            if (usedProjectIndices.size >= projects.length) {
                console.log('All projects have been shown');
                return;
            }

            // Convert percentages to numbers and find the highest
            const percentages = [
                { category: 'ART', value: parseFloat(artPercent) || 0 },
                { category: 'COMMUNITY', value: parseFloat(communityPercent) || 0 },
                { category: 'ECOLOGY', value: parseFloat(ecologyPercent) || 0 },
                { category: 'RESEARCH', value: parseFloat(researchPercent) || 0 },
                { category: 'HEALTH', value: parseFloat(healthPercent) || 0 },
                { category: 'EDUCATION', value: parseFloat(educationPercent) || 0 }
            ].sort((a, b) => b.value - a.value);

            // Find available projects that match the highest percentage category
            let primaryProjects = [];
            let secondaryProjects = [];
            let finalProjects = [];

            // First try primary category
            primaryProjects = projects.filter((project, index) => 
                !usedProjectIndices.has(index) && 
                project.primarycategory === percentages[0].category
            );

            if(percentages[1].value > 0){
                secondaryProjects = projects.filter((project, index) => 
                    !usedProjectIndices.has(index) && 
                    project.secondarycategory.split(', ').includes(percentages[1].category)
                );
            }

            // If still no matches, return
            if (primaryProjects.length === 0 && secondaryProjects.length === 0) {
                return;
            }

            console.log('primaryProjects');
            primaryProjects.forEach((project) => {
                console.log(project.title);
            });

            console.log('\nsecondaryProjects');
            secondaryProjects.forEach((project) => {
                console.log(project.title);
            });

            // Find common projects if both arrays are non-empty
            if (primaryProjects.length > 0 && secondaryProjects.length > 0) {
                finalProjects = primaryProjects.filter(primaryProject =>
                    secondaryProjects.some(secondaryProject => secondaryProject.title === primaryProject.title)
                );
                // If no common projects, combine both arrays
                if (finalProjects.length === 0) {
                    finalProjects = primaryProjects.concat(secondaryProjects);
                }
            } else {
                // If either array is empty, use the non-empty one
                finalProjects = primaryProjects.length > 0 ? primaryProjects : secondaryProjects;
            }

            console.log('\nfinalProjects');
            finalProjects.forEach((project) => {
                console.log(project.title);
            });

            // Select random project from final projects
            const randomIndex = Math.floor(Math.random() * finalProjects.length);
            const project = finalProjects[randomIndex];
            
            // Mark this project as used
            const projectIndex = projects.indexOf(project);
            usedProjectIndices.add(projectIndex);

            const card = createProjectCard(
                project.title,
                project.author,
                project.date,
                project.link,
                project.details,
                project.artistdescription || ''
            );
            card.y = currentY;
            scrollContainer.addChild(card);
            currentY += card.height + cardSpacing;

            // Auto-scroll to reveal the newest card if the list overflows.
            const autoTargetY = LIST_TOP - Math.max(0, currentY - viewportHeight);
            gsap.killTweensOf(scrollContainer);
            gsap.to(scrollContainer, { y: autoTargetY, duration: 0.3, ease: 'power2.out' });

            return card;
        }

        // Export the function globally
        window.addRandomProject = addRandomProject;

        // Create and apply mask for scrolling
        const scrollMask = new PIXI.Graphics();
        scrollMask.beginFill(0xFFFFFF);
        scrollMask.drawRect(0, LIST_TOP, 300, viewportHeight);
        scrollMask.endFill();
        scrollContainer.mask = scrollMask;

        bgContainer.addChild(scrollContainer);
        bgContainer.addChild(scrollMask);

        // ===== Scrolling (no visible scrollbar) =====
        // Content height grows as cards are added, so compute the scroll range live.
        scrollContainer.eventMode = 'static';
        scrollContainer.cursor = 'grab';

        function getMaxScroll() {
            return Math.max(0, currentY - viewportHeight);
        }
        function clampScrollY(y) {
            const minY = LIST_TOP - getMaxScroll();
            return Math.max(minY, Math.min(LIST_TOP, y));
        }

        // Mouse wheel (faster response)
        scrollContainer.on('wheel', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = clampScrollY(scrollContainer.y - event.deltaY * 1.3);
            gsap.killTweensOf(scrollContainer);
            gsap.to(scrollContainer, { y: target, duration: 0.18, ease: 'power2.out' });
        }, { passive: false });

        // Drag scrolling with momentum
        let isDragging = false;
        let lastDragY = 0;
        let dragVelocity = 0;
        let lastDragTime = 0;

        scrollContainer.on('pointerdown', (event) => {
            isDragging = true;
            lastDragY = event.globalY;
            lastDragTime = Date.now();
            dragVelocity = 0;
            scrollContainer.cursor = 'grabbing';
            gsap.killTweensOf(scrollContainer);
        });

        app.stage.on('pointermove', (event) => {
            if (!isDragging) return;
            const now = Date.now();
            const dt = now - lastDragTime;
            const dy = event.globalY - lastDragY;
            if (dt > 0) dragVelocity = dy / dt;
            scrollContainer.y = clampScrollY(scrollContainer.y + dy);
            lastDragY = event.globalY;
            lastDragTime = now;
        });

        function handleDragEnd() {
            if (!isDragging) return;
            isDragging = false;
            scrollContainer.cursor = 'grab';
            if (Math.abs(dragVelocity) > 0.05) {
                const target = clampScrollY(scrollContainer.y + dragVelocity * 200);
                gsap.to(scrollContainer, { y: target, duration: 0.6, ease: 'expo.out' });
            }
            dragVelocity = 0;
        }
        app.stage.on('pointerup', handleDragEnd);
        app.stage.on('pointerupoutside', handleDragEnd);

        imageContainer.addChild(bgContainer);
        app.stage.addChild(imageContainer);

    } catch (error) {
        console.error('Error in initInfoSection:', error);
    }
}

export { initInfoSection, archiveIndexValueLabelText };