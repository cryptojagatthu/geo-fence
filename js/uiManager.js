/**
 * UI Manager for IoT Tracking System
 * Handles DOM updates, buttons, and alerts rendering.
 */

import { map, locateUser } from './mapManager.js';
import { exportFence, importFence, exportFenceToESP32, fetchSavedFences, saveFenceToLibrary, deleteFenceFromLibrary, loadFenceDataToMap, syncFenceToApi, syncNoneToApi } from './dataManager.js';
import { getFenceLayer } from './fenceLogic.js';
import { setAutoTracking } from './cowManager.js';

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

    const btnLocateMe = document.getElementById('btn-locate-me');
    if (btnLocateMe) {
        btnLocateMe.addEventListener('click', () => {
            locateUser();
        });
    }

    const chkAutoTrack = document.getElementById('chk-auto-track');
    if (chkAutoTrack) {
        chkAutoTrack.addEventListener('change', (e) => {
            setAutoTracking(e.target.checked);
        });
    }

    const btnClear = document.getElementById('btn-clear-fence');
    if (btnClear) {
        btnClear.addEventListener('click', async () => {
            const drawnItems = getFenceLayer();
            drawnItems.clearLayers();
            
            // Sync "none" state to cloud
            syncStatus.classList.remove('hidden');
            syncStatus.style.background = '#fef3c7';
            syncStatus.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Unloading...';

            try {
                await syncNoneToApi();
                syncStatus.style.background = '#dcfce7';
                syncStatus.innerHTML = '<i class="fa-solid fa-check"></i> Unloaded Successfully!';
            } catch (err) {
                syncStatus.style.background = '#fee2e2';
                syncStatus.innerHTML = '<i class="fa-solid fa-xmark"></i> Unload Failed';
            }
            setTimeout(() => syncStatus.classList.add('hidden'), 3000);
        });
    }

    // --- Library Controls ---
    const btnSaveLibrary = document.getElementById('btn-save-library');
    if (btnSaveLibrary) {
        btnSaveLibrary.addEventListener('click', async () => {
            const fenceLayer = getFenceLayer();
            if (!fenceLayer || fenceLayer.getLayers().length === 0) {
                alert("Draw a fence first!");
                return;
            }

            const name = prompt("Enter a name for this boundary:", `Fence ${new Date().toLocaleDateString()}`);
            if (!name) return;

            try {
                await saveFenceToLibrary(name, fenceLayer);
                await refreshLibrary();
            } catch (err) {
                alert("Failed to save to library: " + err.message);
            }
        });
    }

    // Initial fetch of alert history and library
    fetchAlertHistory();
    refreshLibrary();
}

async function refreshLibrary() {
    const fences = await fetchSavedFences();
    renderLibrary(fences);
}

function renderLibrary(fences) {
    const libraryList = document.getElementById('fence-library-list');
    if (!libraryList) return;

    if (fences.length === 0) {
        libraryList.innerHTML = '<div style="color: #64748b; font-style: italic;">No saved fences.</div>';
        return;
    }

    libraryList.innerHTML = fences.map(f => {
        const dateStr = new Date(f.timestamp).toLocaleDateString();
        return `
            <div class="library-item" data-id="${f._id}">
                <div class="library-item-header">
                    <span class="library-item-name" title="Click to load to map">${f.name}</span>
                    <span class="library-item-date">${dateStr}</span>
                </div>
                <div class="library-item-actions">
                    <button class="btn btn-secondary btn-xs btn-load" title="Restore to map"><i class="fa-solid fa-folder-open"></i> Load</button>
                    <button class="btn btn-success btn-xs btn-sync-item" title="Sync this version to cloud"><i class="fa-solid fa-cloud-arrow-up"></i> Sync</button>
                    <button class="btn btn-danger btn-xs btn-delete-item" title="Delete from library"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;
    }).join('');

    // Event Delegation for library actions
    libraryList.querySelectorAll('.library-item').forEach(item => {
        const id = item.dataset.id;
        const fence = fences.find(f => f._id === id);

        item.querySelector('.library-item-name').addEventListener('click', () => {
            loadFenceDataToMap(fence.data, map, getFenceLayer());
        });

        item.querySelector('.btn-load').addEventListener('click', () => {
            loadFenceDataToMap(fence.data, map, getFenceLayer());
        });

        item.querySelector('.btn-sync-item').addEventListener('click', async (e) => {
            const btn = e.currentTarget;
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
            btn.disabled = true;

            try {
                // To sync from library, we temporarily load it to a dummy layer group or just send the data object
                const response = await fetch('/api/geofence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(fence.data)
                });
                if (!response.ok) throw new Error("Sync failed");
                btn.innerHTML = '<i class="fa-solid fa-check"></i>';
                btn.classList.replace('btn-success', 'btn-primary');
                setTimeout(() => {
                    btn.innerHTML = originalHtml;
                    btn.classList.replace('btn-primary', 'btn-success');
                    btn.disabled = false;
                }, 2000);
            } catch (err) {
                alert("Sync failed: " + err.message);
                btn.innerHTML = originalHtml;
                btn.disabled = false;
            }
        });

        item.querySelector('.btn-delete-item').addEventListener('click', async () => {
            if (!confirm(`Delete "${fence.name}"?`)) return;
            try {
                await deleteFenceFromLibrary(id);
                await refreshLibrary();
            } catch (err) {
                alert("Delete failed: " + err.message);
            }
        });
    });
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
