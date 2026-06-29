import { app, projects, PLAIN_COLORS, stageHeight, interactiveRect } from './Config.js';
import { createProjectCard } from './ProjectCard.js';
import { indexBg, whiteCircleBg } from './Resources.js';
import { openArchivePanel } from './ArchivePanel.js';
import { initFrogAnimator, spawnFrog } from './FrogAnimator.js';

const container = document.getElementById('app-container');

let archiveIndexValueLabelText;
let viewportHeight = 900;

// ---- Help dialog (DOM overlay above the canvas) ----
let helpBackdropEl = null;
let currentFrog = null;

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

async function showHelpDialog() {
    buildHelpDialog();
    helpBackdropEl.classList.add('open');

    // Spawn frog from center of the main content box (underneath the DOM dialog)
    await initFrogAnimator();
    const frogX = interactiveRect.x + interactiveRect.width / 2;
    const frogY = stageHeight / 2;
    currentFrog = spawnFrog(frogX, frogY);
}

function hideHelpDialog() {
    if (helpBackdropEl) helpBackdropEl.classList.remove('open');

    if (currentFrog) {
        currentFrog.drop();
        currentFrog = null;
    }
}

async function initInfoSection() {
    try {

        const LIST_TOP = 100;
        const LIST_BOTTOM_MARGIN = 100;

        viewportHeight = stageHeight - LIST_TOP - LIST_BOTTOM_MARGIN;

        const imageContainer = new PIXI.Container();
        imageContainer.x = 10;
        imageContainer.y = 10;
        imageContainer.eventMode = 'static';

        const bgContainer = new PIXI.Container();

        //archiveIndex -- circular button (flat, no shadow) -----------------
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

        const archivePlus = PIXI.Sprite.from('assets/UI-ELEMENTS/PLUS.png');
        archivePlus.anchor.set(0.5);
        archivePlus.scale.set(34 / 512);
        archivePlus.eventMode = 'none';
        archiveIndexButton.addChild(archivePlus);

        archiveIndexValueLabelText = new PIXI.Text('0', { fontFamily: 'Gelasio', fontSize: 22, fill: 0x808080 });
        archiveIndexValueLabelText.visible = false;
        archiveIndexValueLabelText.eventMode = 'none';

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
            openArchivePanel();
        });

        bgContainer.addChild(archiveIndexButton);
        bgContainer.addChild(archiveHoverLabel);

        //help -- circular button at the bottom-left corner -----------------
        const helpBtnRadius = 30;
        const helpButton = new PIXI.Container();
        helpButton.x = 4 + helpBtnRadius;
        helpButton.y = stageHeight - 14 - helpBtnRadius - 10;
        helpButton.eventMode = 'static';
        helpButton.cursor = 'pointer';
        helpButton.hitArea = new PIXI.Circle(0, 0, helpBtnRadius);

        const helpBtnBg = new PIXI.Graphics();
        helpBtnBg.beginFill(0xffffff);
        helpBtnBg.drawCircle(0, 0, helpBtnRadius);
        helpBtnBg.endFill();
        helpButton.addChild(helpBtnBg);

        const helpMark = PIXI.Sprite.from('assets/UI-ELEMENTS/HELP.png');
        helpMark.anchor.set(0.5);
        helpMark.scale.set(58 / 512);
        helpMark.y = 1;
        helpMark.eventMode = 'none';
        helpButton.addChild(helpMark);

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

        let currentY = 0;
        const cardSpacing = 10;
        let usedProjectIndices = new Set();

        function clearAllProjects() {
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

        function addRandomProject(artPercent, communityPercent, ecologyPercent, researchPercent, healthPercent, educationPercent) {
            if (usedProjectIndices.size >= projects.length) {
                console.log('All projects have been shown');
                return;
            }

            const percentages = [
                { category: 'ART', value: parseFloat(artPercent) || 0 },
                { category: 'COMMUNITY', value: parseFloat(communityPercent) || 0 },
                { category: 'ECOLOGY', value: parseFloat(ecologyPercent) || 0 },
                { category: 'RESEARCH', value: parseFloat(researchPercent) || 0 },
                { category: 'HEALTH', value: parseFloat(healthPercent) || 0 },
                { category: 'EDUCATION', value: parseFloat(educationPercent) || 0 }
            ].sort((a, b) => b.value - a.value);

            let primaryProjects = [];
            let secondaryProjects = [];
            let finalProjects = [];

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

            if (primaryProjects.length > 0 && secondaryProjects.length > 0) {
                finalProjects = primaryProjects.filter(primaryProject =>
                    secondaryProjects.some(secondaryProject => secondaryProject.title === primaryProject.title)
                );
                if (finalProjects.length === 0) {
                    finalProjects = primaryProjects.concat(secondaryProjects);
                }
            } else {
                finalProjects = primaryProjects.length > 0 ? primaryProjects : secondaryProjects;
            }

            console.log('\nfinalProjects');
            finalProjects.forEach((project) => {
                console.log(project.title);
            });

            const randomIndex = Math.floor(Math.random() * finalProjects.length);
            const project = finalProjects[randomIndex];
            
            const projectIndex = projects.indexOf(project);
            usedProjectIndices.add(projectIndex);

         const card = createProjectCard(
    project.title,
    project.author,
    project.date,
    project.link,
    project.details,
    project.artistdescription || '',
    0, 0,
    [
        parseFloat(artPercent) || 0,
        parseFloat(communityPercent) || 0,
        parseFloat(ecologyPercent) || 0,
        parseFloat(researchPercent) || 0,
        parseFloat(healthPercent) || 0,
        parseFloat(educationPercent) || 0
    ]
);

            card.y = currentY;
            scrollContainer.addChild(card);
            currentY += card.height + cardSpacing;

            const autoTargetY = LIST_TOP - Math.max(0, currentY - viewportHeight);
            gsap.killTweensOf(scrollContainer);
            gsap.to(scrollContainer, { y: autoTargetY, duration: 0.3, ease: 'power2.out' });

            return card;
        }

        window.addRandomProject = addRandomProject;

        const scrollMask = new PIXI.Graphics();
        scrollMask.beginFill(0xFFFFFF);
        scrollMask.drawRect(0, LIST_TOP, 300, viewportHeight);
        scrollMask.endFill();
        scrollContainer.mask = scrollMask;

        bgContainer.addChild(scrollContainer);
        bgContainer.addChild(scrollMask);

        // ===== Scrolling (no visible scrollbar) =====
        scrollContainer.eventMode = 'static';
        scrollContainer.cursor = 'grab';

        function getMaxScroll() {
            return Math.max(0, currentY - viewportHeight);
        }
        function clampScrollY(y) {
            const minY = LIST_TOP - getMaxScroll();
            return Math.max(minY, Math.min(LIST_TOP, y));
        }

        scrollContainer.on('wheel', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = clampScrollY(scrollContainer.y - event.deltaY * 1.3);
            gsap.killTweensOf(scrollContainer);
            gsap.to(scrollContainer, { y: target, duration: 0.18, ease: 'power2.out' });
        }, { passive: false });

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