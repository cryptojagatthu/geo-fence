/**
 * Main Application Logic
 */
import { initMap, map } from './mapManager.js';
import { setupFenceControls, getFenceLayer } from './fenceLogic.js';
import { setupCow, startSimulation, stopSimulation } from './cowManager.js';
import { setupUI } from './uiManager.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Geo-Fence Simulator Initializing...');

    // 1. Initialize Map
    initMap('map');

    // 2. Setup Fence Logic
    setupFenceControls(map);

    // 3. Setup Cow Simulation
    setupCow(map);

    // 4. Bind UI Controls
    setupUI();

    console.log('Initialization Complete.');
});
