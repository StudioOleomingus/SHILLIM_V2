import { app, projects, PLAIN_COLORS } from './Config.js';
import { createProjectCard } from './ProjectCard.js';
import { indexBg, whiteCircleBg } from './Resources.js';

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

        //archiveIndex--------------------------------------
        const archiveIndexRect = {
            x: 0,
            y: 0,
            width: 290,
            height: 74,
        };

        const archiveIndexImage = new PIXI.Sprite(indexBg);
        archiveIndexImage.x = archiveIndexRect.x;
        archiveIndexImage.y = archiveIndexRect.y;
        archiveIndexImage.width = archiveIndexRect.width;
        archiveIndexImage.height = archiveIndexRect.height;
        archiveIndexImage.eventMode = 'static';
        archiveIndexImage.cursor = 'pointer';
        archiveIndexImage.on('pointerdown', () => {
            window.open('projectindex.html', '_blank');
        });

        // Add text element with padding
        const archiveIndexLabelText = new PIXI.Text('archive index', {
            fontFamily: 'Georgia',
            fontSize: 21,
            fill: 0xB0B0B0,
            align: 'left',
            fontStyle: 'italic'
        });
        archiveIndexLabelText.x = 24; // 10px padding from left
        archiveIndexLabelText.y = 24; // 10px padding from top
        archiveIndexLabelText.eventMode = 'none';

        //archiveIndexValue--------------------------------------

        const archiveIndexValueRect = {
            x: 230,
            y: 15,
            width: 40,
            height: 40,
        };

        const archiveIndexValueImage = new PIXI.Sprite(whiteCircleBg);
        archiveIndexValueImage.x = archiveIndexValueRect.x;
        archiveIndexValueImage.y = archiveIndexValueRect.y;
        archiveIndexValueImage.width = archiveIndexValueRect.width;
        archiveIndexValueImage.height = archiveIndexValueRect.height;

        // Add text element with padding
        archiveIndexValueLabelText = new PIXI.Text('0', {
            fontFamily: 'Arial',
            fontSize: 20,
            fill: 0x808080,
            align: 'center',
            fontStyle: 'italic'
        });
        archiveIndexValueLabelText.x = archiveIndexValueRect.x + 13; // 10px padding from left
        archiveIndexValueLabelText.y = 24; // 10px padding from top
        archiveIndexValueLabelText.eventMode = 'none';

        // Add archive index elements to the container
        bgContainer.addChild(archiveIndexImage);
        bgContainer.addChild(archiveIndexLabelText);
        bgContainer.addChild(archiveIndexValueImage);
        bgContainer.addChild(archiveIndexValueLabelText);

        // Create scrollable container
        const scrollContainer = new PIXI.Container();
        scrollContainer.x = 0;
        scrollContainer.y = 60;
        scrollContainer.width = 300;
        scrollContainer.height = 900;
        scrollContainer.eventMode = 'static';

        // Add project cards to scroll container
        // Add light gray background to scroll container
        const scrollBg = new PIXI.Graphics();
        scrollBg.beginFill(0xFFFFFF); // Very light gray
        scrollBg.drawRect(0, 60, 300, 900);
        scrollBg.endFill();
        scrollContainer.addChild(scrollBg);

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

        // Calculate total content height for scrolling
        const contentHeight = currentY;
        
        // Add scrollbar if content exceeds viewport
        if (contentHeight > viewportHeight) {
            // Scrollbar background
            const scrollbarBg = new PIXI.Graphics();
            scrollbarBg.beginFill(0xDDDDDD);
            scrollbarBg.drawRect(290, 60, 4, viewportHeight);
            scrollbarBg.endFill();
            scrollbarBg.visible = false;
            bgContainer.addChild(scrollbarBg);

            // Scrollbar thumb
            const thumbHeight = Math.max(50, (viewportHeight / contentHeight) * viewportHeight);
            const scrollbarThumb = new PIXI.Graphics();
            scrollbarThumb.beginFill(0x808080);
            scrollbarThumb.drawRect(290, 60, 4, thumbHeight);
            scrollbarThumb.endFill();
            scrollbarThumb.interactive = true;
            scrollbarThumb.cursor = 'pointer';
            scrollbarThumb.visible = false;
            bgContainer.addChild(scrollbarThumb);

            // Scrolling with mouse wheel
            // Enable mouse wheel scrolling
            scrollContainer.eventMode = 'static';
            scrollContainer.cursor = 'grab';
            
            // Variables for drag scrolling
            let isDragging = false;
            let dragStartY = 0;
            let startScrollY = 0;

            // Mouse wheel scrolling with smooth animation
            let wheelTimeout;
            let lastWheelTime = 0;
            let accumulatedDelta = 0;
            
            scrollContainer.on('wheel', (event) => {
                event.preventDefault();
                event.stopPropagation();
                
                const currentTime = Date.now();
                const timeDelta = currentTime - lastWheelTime;
                
                // Clear timeout if wheel event is within 150ms of last event
                if (timeDelta < 150) {
                    if (wheelTimeout) clearTimeout(wheelTimeout);
                    accumulatedDelta += event.deltaY * 0.5; // Reduce sensitivity for smoother scrolling
                } else {
                    accumulatedDelta = event.deltaY * 0.5;
                }
                
                const maxScroll = -(contentHeight - viewportHeight);
                const targetY = Math.max(maxScroll + 60, Math.min(60, scrollContainer.y - accumulatedDelta));
                
                if (targetY !== scrollContainer.y) {
                    // Kill any existing tweens
                    gsap.killTweensOf(scrollContainer);
                    gsap.killTweensOf(scrollbarThumb);
                    
                    // Set a short timeout to wait for multiple wheel events
                    wheelTimeout = setTimeout(() => {
                        smoothScrollTo(targetY, 0.6); // Slightly faster for wheel scrolling
                        accumulatedDelta = 0; // Reset accumulated delta
                    }, 50);
                    
                    // Smooth intermediate updates
                    gsap.to(scrollContainer, {
                        y: targetY,
                        duration: 0.1,
                        ease: 'power1.out',
                        onUpdate: () => updateScrollbarPosition()
                    });
                }
                
                lastWheelTime = currentTime;
            }, { passive: false });

            // Drag scrolling with smooth animation
            let lastDragY = 0;
            let dragVelocity = 0;
            let lastDragTime = 0;
            
            scrollContainer.on('pointerdown', (event) => {
                isDragging = true;
                dragStartY = event.globalY;
                startScrollY = scrollContainer.y;
                lastDragY = event.globalY;
                lastDragTime = Date.now();
                dragVelocity = 0;
                scrollContainer.cursor = 'grabbing';
                
                // Kill any existing tweens
                gsap.killTweensOf(scrollContainer);
                gsap.killTweensOf(scrollbarThumb);
            });

            app.stage.on('pointermove', (event) => {
                if (!isDragging) return;
                
                const currentTime = Date.now();
                const timeDelta = currentTime - lastDragTime;
                const deltaY = event.globalY - lastDragY;
                
                if (timeDelta > 0) {
                    dragVelocity = deltaY / timeDelta;
                }
                
                const maxScroll = -(contentHeight - viewportHeight);
                const targetY = Math.max(maxScroll + 60, Math.min(60, scrollContainer.y + deltaY));
                
                scrollContainer.y = targetY;
                updateScrollbarPosition();
                
                lastDragY = event.globalY;
                lastDragTime = currentTime;
            });

            function handleDragEnd() {
                if (!isDragging) return;
                
                isDragging = false;
                scrollContainer.cursor = 'grab';
                
                // Apply momentum scrolling if there's velocity
                if (Math.abs(dragVelocity) > 0.05) { // Lower threshold for smoother momentum
                    const momentum = dragVelocity * 200; // Increased multiplier for more momentum
                    const maxScroll = -(contentHeight - viewportHeight);
                    const targetY = Math.max(maxScroll + 60, Math.min(60, scrollContainer.y + momentum));
                    
                    smoothScrollTo(targetY, Math.abs(dragVelocity) * 0.8 + 0.6); // Dynamic duration based on velocity
                }
                
                // Reset drag state
                dragVelocity = 0;
            }

            app.stage.on('pointerup', handleDragEnd);
            app.stage.on('pointerupoutside', handleDragEnd);

            // Helper function to smoothly scroll to a position
            function smoothScrollTo(targetY, duration = 0.8) { // Increased base duration
                // Kill any existing tweens
                gsap.killTweensOf(scrollContainer);
                gsap.killTweensOf(scrollbarThumb);

                // Calculate the distance to scroll
                const distance = Math.abs(targetY - scrollContainer.y);
                const adjustedDuration = Math.min(1.2, duration * (distance / 500)); // Scale duration with distance

                gsap.to(scrollContainer, {
                    y: targetY,
                    duration: adjustedDuration,
                    ease: 'expo.out', // Changed to expo for smoother deceleration
                    onUpdate: () => {
                        const scrollPercent = (60 - scrollContainer.y) / (contentHeight - viewportHeight);
                        gsap.to(scrollbarThumb, {
                            y: 60 + (scrollPercent * (viewportHeight - thumbHeight)),
                            duration: 0.15, // Slightly increased for smoother thumb movement
                            ease: 'power1.out' // Added slight easing to thumb movement
                        });
                    }
                });
            }

            // Helper function to update scrollbar position immediately
            function updateScrollbarPosition() {
                const scrollPercent = (60 - scrollContainer.y) / (contentHeight - viewportHeight);
                scrollbarThumb.y = 60 + (scrollPercent * (viewportHeight - thumbHeight));
            }
        }

        imageContainer.addChild(bgContainer);
        app.stage.addChild(imageContainer);

    } catch (error) {
        console.error('Error in initInfoSection:', error);
    }
}

export { initInfoSection, archiveIndexValueLabelText };