/**
 * UI Manager
 * Handles DOM updates, buttons, and alerts.
 */

import { startSimulation, stopSimulation, startLiveTracking, stopLiveTracking, resetCow } from './cowManager.js';
import { map } from './mapManager.js';
import { exportFence, importFence, exportFenceToESP32 } from './dataManager.js';
import { getFenceLayer } from './fenceLogic.js';

// Status caching to prevent flickering
let lastStatus = null;

export function setupUI() {

    // --- Simulation Controls ---
    const toggleWalk = document.getElementById('toggle-auto-walk');
    const toggleGPS = document.getElementById('toggle-live-gps');

    if (toggleWalk) {
        toggleWalk.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Turn off GPS if on
                if (toggleGPS && toggleGPS.checked) {
                    toggleGPS.checked = false;
                    stopLiveTracking();
                }
                startSimulation();
            } else {
                stopSimulation();
            }
        });
    }

    if (toggleGPS) {
        toggleGPS.addEventListener('change', (e) => {
            if (e.target.checked) {
                // Turn off Auto-Walk if on
                if (toggleWalk && toggleWalk.checked) {
                    toggleWalk.checked = false;
                    stopSimulation();
                }
                startLiveTracking();
            } else {
                stopLiveTracking();
            }
        });
    }

    const btnReset = document.getElementById('btn-reset-cow');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            resetCow(map);
        });
    }

    // --- Data Controls ---
    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const fenceLayer = getFenceLayer();
            exportFence(fenceLayer);
        });
    }

    const btnSyncApi = document.getElementById('btn-sync-api');
    const btnExportFirmware = document.getElementById('btn-export-firmware');
    const syncStatus = document.getElementById('sync-status');
    const esp32Container = document.getElementById('esp32-output-container');
    const esp32Textarea = document.getElementById('esp32-json-output');
    const esp32Label = document.getElementById('esp32-output-label');
    const btnCopyESP32 = document.getElementById('btn-copy-esp32');

    if (btnSyncApi) {
        btnSyncApi.addEventListener('click', async () => {
            const fenceLayer = getFenceLayer();
            if (!fenceLayer || fenceLayer.getLayers().length === 0) {
                alert("Draw a fence first!");
                return;
            }

            syncStatus.classList.remove('hidden');
            syncStatus.style.background = '#fef3c7'; // Warning/Pending
            syncStatus.style.color = '#92400e';
            syncStatus.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Syncing to Cloud...';

            try {
                const { syncFenceToApi } = await import('./dataManager.js');
                await syncFenceToApi(fenceLayer);

                syncStatus.style.background = '#dcfce7'; // Success
                syncStatus.style.color = '#166534';
                syncStatus.innerHTML = '<i class="fa-solid fa-check"></i> Synced Successfully!';
            } catch (err) {
                syncStatus.style.background = '#fee2e2'; // Error
                syncStatus.style.color = '#991b1b';
                syncStatus.innerHTML = '<i class="fa-solid fa-xmark"></i> Sync Failed';
            }
            setTimeout(() => syncStatus.classList.add('hidden'), 3000);
        });
    }

    if (btnExportFirmware) {
        btnExportFirmware.addEventListener('click', async () => {
            try {
                const { getFenceLayer } = await import('./fenceLogic.js');
                const { exportFenceToEsp32Firmware } = await import('./dataManager.js');

                const fenceLayer = getFenceLayer();
                const firmwareCode = exportFenceToEsp32Firmware(fenceLayer);

                if (firmwareCode) {
                    esp32Container.classList.remove('hidden');
                    esp32Container.style.display = 'block';
                    esp32Label.textContent = "C++ Firmware Code (Copy/Paste):";
                    esp32Textarea.value = firmwareCode;
                }
            } catch (e) {
                console.error("Export Failed:", e);
                alert("Export Failed: " + e.message);
            }
        });
    }

    if (btnCopyESP32) {
        btnCopyESP32.addEventListener('click', () => {
            esp32Textarea.select();
            document.execCommand('copy'); // Fallback
            // Modern API
            navigator.clipboard.writeText(esp32Textarea.value).then(() => {
                const originalText = btnCopyESP32.innerHTML;
                btnCopyESP32.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                setTimeout(() => {
                    btnCopyESP32.innerHTML = originalText;
                }, 2000);
            });
        });
    }

    const btnImport = document.getElementById('btn-import');
    const fileInput = document.getElementById('file-import');

    if (btnImport && fileInput) {
        btnImport.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const fenceLayer = getFenceLayer();
                importFence(file, map, fenceLayer);
                fileInput.value = ''; // Reset for consecutive imports
            }
        });
    }

    // We'll hook up drawing buttons in main or fenceLogic when we add Leaflet.Draw
}

export function updateCoords(lat, lng) {
    document.getElementById('cow-lat').textContent = lat.toFixed(5);
    document.getElementById('cow-lng').textContent = lng.toFixed(5);
}

export function updateStatus(isSafe) {
    const statusCard = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const alertBanner = document.getElementById('alert-banner');
    const audioAlert = document.getElementById('audio-alert');

    // Debounce/Hysteresis logic could go here if needed
    // For now, direct update

    if (isSafe) {
        if (lastStatus === 'safe') return;

        statusCard.className = 'status-card safe';
        statusText.textContent = 'Inside Safe Zone';
        alertBanner.classList.add('hidden');

        // Stop audio
        audioAlert.pause();
        audioAlert.currentTime = 0;

        lastStatus = 'safe';
    } else {
        // Only trigger danger if there are actually fences drawn
        // If no fences, technically "outside" but maybe we want a "No Fence" state?
        // For simplicity, let's assume if there are fences, handling is active.
        // We might need to check if any layers exist.

        // Check if any fences exist
        // This circular dependency (ui -> fence) needs to be handled carefully. 
        // We will deal with it in fenceLogic passing a 'hasFences' flag or checking layers count.
        // For now, assume if this is called, logic ran.

        if (lastStatus === 'danger') return;

        statusCard.className = 'status-card danger';
        statusText.textContent = 'OUTSIDE FENCE';
        alertBanner.classList.remove('hidden');

        // Play audio
        audioAlert.play().catch(e => console.log('Audio play failed (interaction needed):', e));

        lastStatus = 'danger';
    }
}
