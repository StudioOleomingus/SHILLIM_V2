import { app, projects, PLAIN_COLORS } from './Config.js';
import { createProjectCard } from './ProjectCard.js';
import { indexBg, whiteCircleBg } from './Resources.js';
import { openArchivePanel } from './ArchivePanel.js';

const container = document.getElementById('app-container');

let archiveIndexValueLabelText;
let viewportHeight = 900;

async function initInfoSection() {
    try {

         // Handle window resizing
         function resize() {

            viewportHeight = container.clientHeight - 60;
        }

        // Initial resize
        resize();

        // Add window resize listener
        window.addEventListener('resize', resize);

        // Create a container for the image section
        const imageContainer = new PIXI.Container();
        imageContainer.x = 10;  // Position from left
        imageContainer.y = 10;    // Position from top
        imageContainer.eventMode = 'static';

        // Create a container for the background with effects
        const bgContainer = new PIXI.Container();

        //archiveIndex -- circular button (flat, no shadow) -----------------
        const archiveBtnRadius = 30;
        const archiveIndexButton = new PIXI.Container();
        archiveIndexButton.x = 24 + archiveBtnRadius;
        archiveIndexButton.y = 24 + archiveBtnRadius;
        archiveIndexButton.eventMode = 'static';
        archiveIndexButton.cursor = 'pointer';
        archiveIndexButton.hitArea = new PIXI.Circle(0, 0, archiveBtnRadius);

        const archiveBtnBg = new PIXI.Graphics();
        archiveBtnBg.lineStyle(1.5, 0xd2d2d2, 1);
        archiveBtnBg.beginFill(0xffffff);
        archiveBtnBg.drawCircle(0, 0, archiveBtnRadius);
        archiveBtnBg.endFill();
        archiveIndexButton.addChild(archiveBtnBg);

        // Count value is still tracked (updated elsewhere) but no longer shown.
        archiveIndexValueLabelText = new PIXI.Text('0', { fontFamily: 'Georgia', fontSize: 22, fill: 0x808080 });
        archiveIndexValueLabelText.visible = false;
        archiveIndexValueLabelText.eventMode = 'none';

        archiveIndexButton.on('pointerover', () => { archiveBtnBg.tint = 0xf0f0f0; });
        archiveIndexButton.on('pointerout', () => { archiveBtnBg.tint = 0xffffff; });
        archiveIndexButton.on('pointerdown', () => {
            // Cascade the project index out from the right as an in-page panel.
            openArchivePanel();
        });

        bgContainer.addChild(archiveIndexButton);

        // Create scrollable container
        const scrollContainer = new PIXI.Container();
        scrollContainer.x = 0;
        scrollContainer.y = 60;
        scrollContainer.width = 300;
        scrollContainer.height = 900;
        scrollContainer.eventMode = 'static';

        // (No filled background here — the #ececec frame shows behind the white cards.)
        let currentY = 60;
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
            currentY = 60;
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

            // Automatically scroll to show new card if needed
            if (currentY > viewportHeight) {
                gsap.to(scrollContainer, {
                    y: Math.min(60, -(currentY - viewportHeight)),
                    duration: 0.5,
                    ease: 'power2.out'
                });
            }

            return card;
        }

        // Export the function globally
        window.addRandomProject = addRandomProject;

        // Create and apply mask for scrolling
        const scrollMask = new PIXI.Graphics();
        scrollMask.beginFill(0xFFFFFF);
        scrollMask.drawRect(0, 60, 300, 900); // Height adjusted to leave space for archive index
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
            const minY = 60 - getMaxScroll();
            return Math.max(minY, Math.min(60, y));
        }

        // Mouse wheel
        scrollContainer.on('wheel', (event) => {
            event.preventDefault();
            event.stopPropagation();
            const target = clampScrollY(scrollContainer.y - event.deltaY * 0.5);
            gsap.killTweensOf(scrollContainer);
            gsap.to(scrollContainer, { y: target, duration: 0.3, ease: 'power2.out' });
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