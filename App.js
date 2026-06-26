import { app } from './Config.js';

async function initApp() {
    try {
        // Configure the application
        await app.init({
            width: 1550,
            height: 1000,
            backgroundColor: 0xECECEC,
            antialias: true,
            resolution: window.devicePixelRatio || 1,
            canvas: document.createElement('canvas')
        });

        // Add rounded corners and stroke to the canvas
        app.view.style.borderRadius = '40px';
       // app.view.style.border = '1px solid rgb(213, 213, 213)';
        app.view.style.backgroundColor = '#ECECEC';
        // The canvas is rendered at a FIXED logical size (1550x1000). It is then
        // scaled to fit the window purely via CSS (see #app-container in
        // shilim.css), so every element inside keeps its mutual proportions and
        // nothing is ever cropped. Let it fill its container; CSS handles the
        // aspect-ratio-preserving downscale.
        app.view.style.width = '100%';
        app.view.style.height = '100%';
        app.view.style.boxShadow = 'none';

        // Add the Pixi canvas to our container
        document.getElementById('app-container').appendChild(app.view);

        // NOTE: We intentionally do NOT resize the PIXI renderer on window
        // resize. The whole experience is laid out in a fixed 1550x1000
        // coordinate space; resizing the renderer would change that space and
        // crop the bottom control bar / text. CSS scaling of the canvas keeps
        // the proportions intact at any window size.

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