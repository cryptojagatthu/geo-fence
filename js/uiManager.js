/**
 * UI Manager for IoT Tracking System
 * Handles DOM updates, buttons, and alerts rendering.
 */

import { map } from './mapManager.js';
import { exportFence, importFence, exportFenceToESP32 } from './dataManager.js';
import { getFenceLayer } from './fenceLogic.js';

let lastStatus = null;
let lastAlertFetchTime = 0;

export function setupUI() {
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
            if(navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(esp32Textarea.value).then(() => {
                    const originalText = btnCopyESP32.innerHTML;
                    btnCopyESP32.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
                    setTimeout(() => {
                        btnCopyESP32.innerHTML = originalText;
                    }, 2000);
                });
            }
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

    // Initial fetch of alert history
    fetchAlertHistory();
}

/**
 * Called every poll cycle from cowManager.js
 */
export function updateDeviceUI(anyOutside, devices) {
    // Update tracking count
    const countEl = document.getElementById('active-device-count');
    if (countEl) countEl.textContent = devices.length;

    const statusCard = document.getElementById('status-indicator');
    const statusText = document.getElementById('status-text');
    const alertBanner = document.getElementById('alert-banner');
    const audioAlert = document.getElementById('audio-alert');

    if (!anyOutside) {
        if (lastStatus === 'safe') return;

        statusCard.className = 'status-card safe';
        statusText.textContent = 'All Devices Inside';
        if (alertBanner) alertBanner.classList.add('hidden');

        if (audioAlert) {
            audioAlert.pause();
            audioAlert.currentTime = 0;
        }

        lastStatus = 'safe';
    } else {
        if (lastStatus === 'danger') {
            // Periodically refresh the sidebar alert history while in danger state
            if (Date.now() - lastAlertFetchTime > 5000) fetchAlertHistory();
            return;
        }

        statusCard.className = 'status-card danger';
        statusText.textContent = 'WARNING: DEVICE OUTSIDE';
        if (alertBanner) alertBanner.classList.remove('hidden');

        // Play audio
        if (audioAlert) {
            audioAlert.play().catch(e => console.log('Audio play failed (interaction needed):', e));
        }

        lastStatus = 'danger';
        fetchAlertHistory();
    }
}

async function fetchAlertHistory() {
    try {
        lastAlertFetchTime = Date.now();
        const res = await fetch('/api/alerts?limit=10');
        if (!res.ok) return;
        
        const alerts = await res.json();
        const historyList = document.getElementById('alert-history-list');
        if (!historyList) return;

        if (alerts.length === 0) {
            historyList.innerHTML = '<div style="color: #64748b; font-style: italic;">No alerts yet.</div>';
            return;
        }

        historyList.innerHTML = alerts.map(a => {
            const timeStr = new Date(a.timestamp).toLocaleTimeString();
            return `
                <div style="background: #fee2e2; border-left: 3px solid #ef4444; padding: 6px; border-radius: 4px; line-height: 1.4;">
                    <strong style="color: #991b1b; display: block; font-size: 11px;">${a.deviceId} <span style="float: right; color: #7f1d1d;">${timeStr}</span></strong>
                    <span style="color: #7f1d1d; font-size: 10px;">${a.lat.toFixed(4)}, ${a.lng.toFixed(4)}</span>
                </div>
            `;
        }).join('');

    } catch (e) {
        console.error("Failed to fetch alert history:", e);
    }
}
