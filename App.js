import { app } from './Config.js';

async function initApp() {
    try {
        // Configure the application
        await app.init({
            width: 1550,
            height: 1000,
            backgroundColor: 0xFFFFFF,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            canvas: document.createElement('canvas')
        });

        // Add rounded corners and stroke to the canvas
        app.view.style.borderRadius = '40px';
       // app.view.style.border = '1px solid rgb(213, 213, 213)';
        app.view.style.backgroundColor = '#FFFFFF';
        app.view.style.width = '1550px';
        app.view.style.height = '1000px';
        app.view.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.2)';

        // Add the Pixi canvas to our container
        document.getElementById('app-container').appendChild(app.view);

        // Handle window resizing
        function resize() {
            const container = document.getElementById('app-container');
            const containerWidth = container.clientWidth;
            const containerHeight = container.clientHeight;
            
            // Update renderer size to match container
            app.renderer.resize(containerWidth, containerHeight);
        }

        // Initial resize
        resize();

        // Add window resize listener
        window.addEventListener('resize', resize);

        try {
            // Initialize the asset loader
            await PIXI.Assets.init();

        } catch (error) {
            console.error('Error loading game assets:', error);
        }
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

export { initApp };