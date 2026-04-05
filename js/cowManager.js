/**
 * Cow Manager (Now IoT Device Manager)
 * Handles fetching device locations and updating multiple markers on the map.
 */

import { isPointInFence } from './fenceLogic.js';
import { updateDeviceUI } from './uiManager.js';

let deviceMarkers = {};
let pollInterval;
const POLL_INTERVAL_MS = 3000;
let mapInstance;
let firstDetection = true; // Auto-focus on first device found

export function setupCow(map) {
    mapInstance = map;
    startPolling();
}

export function startPolling() {
    if (pollInterval) return;
    console.log('Started polling IoT devices...');
    pollInterval = setInterval(fetchLatestDevices, POLL_INTERVAL_MS);
    fetchLatestDevices(); // initial fetch
}

export function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        console.log('Stopped polling IoT devices.');
    }
}

async function fetchLatestDevices() {
    try {
        const response = await fetch('/api/latest');
        if (!response.ok) throw new Error("Failed to fetch latest devices");
        
        const devices = await response.json();
        
        let anyOutside = false;

        devices.forEach(device => {
            const { deviceId, lat, lng, status, battery, timestamp } = device;
            const newLatLng = [lat, lng];
            
            if (status === 'OUTSIDE') anyOutside = true;

            if (deviceMarkers[deviceId]) {
                // Update existing marker
                deviceMarkers[deviceId].setLatLng(newLatLng);
                updateMarkerVisuals(deviceMarkers[deviceId], device);
            } else {
                // Create new marker
                const marker = createDeviceMarker(device);
                marker.addTo(mapInstance);
                deviceMarkers[deviceId] = marker;
            }
        });

        // Auto-focus logic: If this is the first time we see devices, zoom to them
        if (firstDetection && devices.length > 0) {
            const group = new L.featureGroup(Object.values(deviceMarkers));
            mapInstance.fitBounds(group.getBounds().pad(0.5));
            firstDetection = false;
        }

        // Update overall UI status based on if ANY device is outside
        updateDeviceUI(anyOutside, devices);

    } catch (err) {
        console.error("Polling error:", err);
    }
}

function createDeviceMarker(device) {
    const { deviceId, status } = device;
    const color = status === 'OUTSIDE' ? '#dc2626' : '#16a34a'; // Red / Green
    
    // Custom icon with emoji and a label
    const icon = L.divIcon({
        className: 'custom-cow-icon',
        html: `
            <div style="font-size: 28px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); text-align: center;">🐄</div>
            <div style="background: white; color: #1e293b; padding: 2px 6px; border-radius: 12px; font-size: 11px; font-weight: 700; text-align: center; margin-top: -5px; border: 2px solid ${color}; display: inline-block; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                <i class="fa-solid fa-circle" style="color: ${color}; font-size: 8px; margin-right: 3px;"></i>${deviceId}
            </div>
        `,
        iconSize: [60, 50],
        iconAnchor: [30, 25]
    });

    const marker = L.marker([device.lat, device.lng], { icon });
    marker.bindPopup(generatePopupContent(device));
    return marker;
}

function updateMarkerVisuals(marker, device) {
    const { deviceId, status } = device;
    const color = status === 'OUTSIDE' ? '#dc2626' : '#16a34a'; // Red / Green
    
    const icon = L.divIcon({
        className: 'custom-cow-icon',
        html: `
            <div style="font-size: 28px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); text-align: center;">🐄</div>
            <div style="background: white; color: #1e293b; padding: 2px 6px; border-radius: 12px; font-size: 11px; font-weight: 700; text-align: center; margin-top: -5px; border: 2px solid ${color}; display: inline-block; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                <i class="fa-solid fa-circle" style="color: ${color}; font-size: 8px; margin-right: 3px;"></i>${deviceId}
            </div>
        `,
        iconSize: [60, 50],
        iconAnchor: [30, 25]
    });

    marker.setIcon(icon);
    
    // Only update popup content if it's currently open to avoid flickering
    if (marker.isPopupOpen()) {
        marker.setPopupContent(generatePopupContent(device));
    } else {
        // Just bind the new content for the next time it's opened
        marker.bindPopup(generatePopupContent(device));
    }
}

/**
 * Global helper to zoom to a specific device
 */
window.zoomToDevice = (id) => {
    const marker = deviceMarkers[id];
    if (marker) {
        mapInstance.setView(marker.getLatLng(), 18);
        marker.openPopup();
    } else {
        console.warn(`Marker for ${id} not found.`);
    }
};

function generatePopupContent(device) {
    const { deviceId, status, battery, timestamp, lat, lng } = device;
    const timeStr = new Date(timestamp).toLocaleTimeString();
    const color = status === 'OUTSIDE' ? '#dc2626' : '#16a34a';
    
    return `
        <div style="min-width: 160px; font-family: 'Inter', sans-serif;">
            <h4 style="margin: 0 0 8px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; font-size: 14px; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-tag"></i> ${deviceId}</span>
                <span class="fa-solid fa-battery-${battery > 70 ? 'full' : battery > 30 ? 'half' : 'empty'}" style="color: ${battery > 20 ? '#16a34a' : '#dc2626'}"> ${battery}%</span>
            </h4>
            <div style="font-size: 12px; line-height: 1.6;">
                <p style="margin: 2px 0; display: flex; justify-content: space-between;"><b>Status:</b> <strong style="color: ${color}; padding: 2px 6px; background: ${status === 'OUTSIDE' ? '#fee2e2' : '#dcfce7'}; border-radius: 4px;">${status}</strong></p>
                <p style="margin: 4px 0; color: #64748b; font-family: 'Roboto Mono', monospace; font-size: 11px;">${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
                <p style="margin: 6px 0 0 0; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 6px;"><i class="fa-regular fa-clock"></i> Last Update: ${timeStr}</p>
            </div>
        </div>
    `;
}

// Obsolete simulation functions (stubbed out to avoid breaking uiManager if it still calls them)
export function startSimulation() { console.log('Simulation disabled in IoT mode'); }
export function stopSimulation() { }
export function startLiveTracking() { console.log('Live tracking disabled in IoT mode'); }
export function stopLiveTracking() { }
export function resetCow() { }
