/**
 * Cow Manager (Now IoT Device Manager)
 * Handles fetching device locations and updating multiple markers on the map.
 */

import { isPointInFence } from './fenceLogic.js';
import { updateDeviceUI } from './uiManager.js';

let deviceMarkers = {};
let pollInterval = null;
const POLL_INTERVAL_MS = 3000;
let mapInstance;
let currentMode = 'simulation'; // 'simulation' or 'iot'
let simulationMarker = null;

export function setupCow(map) {
    mapInstance = map;
    // By default, start in simulation mode
    setTrackingMode('simulation');
}

/**
 * Switch between manual simulation and IoT tracking
 */
export function setTrackingMode(mode) {
    currentMode = mode;
    console.log(`Tracking mode switched to: ${mode}`);

    if (mode === 'iot') {
        // 1. Cleanup simulation
        if (simulationMarker) {
            mapInstance.removeLayer(simulationMarker);
            simulationMarker = null;
        }
        // 2. Start IoT polling
        startPolling();
    } else {
        // 1. Stop IoT polling
        stopPolling();
        // 2. Clear IoT markers
        Object.values(deviceMarkers).forEach(m => mapInstance.removeLayer(m));
        deviceMarkers = {};
        // 3. Setup simulation marker
        createSimulationMarker();
    }
}

function createSimulationMarker() {
    if (simulationMarker) return;

    const latlng = mapInstance.getCenter();
    const icon = L.divIcon({
        className: 'custom-cow-icon',
        html: `
            <div style="font-size: 28px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); text-align: center;">🐄</div>
            <div style="background: white; color: #1e293b; padding: 2px 6px; border-radius: 12px; font-size: 11px; font-weight: 700; text-align: center; margin-top: -5px; border: 2px solid #2563eb; display: inline-block; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                Simulated
            </div>
        `,
        iconSize: [60, 50],
        iconAnchor: [30, 25]
    });

    simulationMarker = L.marker(latlng, { icon, draggable: true }).addTo(mapInstance);
    
    simulationMarker.on('drag', (e) => {
        const pos = e.target.getLatLng();
        const { getFenceLayer } = require('./fenceLogic.js'); // dynamic import or helper if needed
        // Simulating the 'anyOutside' check for UI
        import('./fenceLogic.js').then(({ getFenceLayer }) => {
            const fence = getFenceLayer();
            const inside = isPointInFence(pos, fence);
            updateDeviceUI(!inside, [{ deviceId: 'Simulated', lat: pos.lat, lng: pos.lng, status: inside ? 'INSIDE' : 'OUTSIDE', battery: 100 }]);
        });
    });

    simulationMarker.bindPopup("<b>Manual Simulation</b><br>Drag me to test the fence!").openPopup();
}

export function startPolling() {
    if (pollInterval) return;
    console.log('Started polling IoT devices...');
    pollInterval = setInterval(fetchLatestDevices, POLL_INTERVAL_MS);
    fetchLatestDevices(); 
}

export function stopPolling() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
        console.log('Stopped polling IoT devices.');
    }
}

async function fetchLatestDevices() {
    if (currentMode !== 'iot') return;

    try {
        const response = await fetch('/api/latest');
        if (!response.ok) throw new Error("Failed to fetch latest devices");
        
        const devices = await response.json();
        
        let anyOutside = false;

        // IDs of devices currently in the response
        const activeIds = new Set(devices.map(d => d.deviceId));

        // Remove markers for devices no longer in the list
        Object.keys(deviceMarkers).forEach(id => {
            if (!activeIds.has(id)) {
                mapInstance.removeLayer(deviceMarkers[id]);
                delete deviceMarkers[id];
            }
        });

        devices.forEach(device => {
            const { deviceId, lat, lng, status, battery, timestamp } = device;
            const newLatLng = [lat, lng];
            
            if (status === 'OUTSIDE') anyOutside = true;

            if (deviceMarkers[deviceId]) {
                deviceMarkers[deviceId].setLatLng(newLatLng);
                updateMarkerVisuals(deviceMarkers[deviceId], device);
            } else {
                const marker = createDeviceMarker(device);
                marker.addTo(mapInstance);
                deviceMarkers[deviceId] = marker;
            }
        });

        updateDeviceUI(anyOutside, devices);

    } catch (err) {
        console.error("Polling error:", err);
    }
}

function createDeviceMarker(device) {
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

    const marker = L.marker([device.lat, device.lng], { icon });
    marker.bindPopup(generatePopupContent(device));
    return marker;
}

function updateMarkerVisuals(marker, device) {
    const { status } = device;
    const color = status === 'OUTSIDE' ? '#dc2626' : '#16a34a';
    
    const icon = L.divIcon({
        className: 'custom-cow-icon',
        html: `
            <div style="font-size: 28px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4)); text-align: center;">🐄</div>
            <div style="background: white; color: #1e293b; padding: 2px 6px; border-radius: 12px; font-size: 11px; font-weight: 700; text-align: center; margin-top: -5px; border: 2px solid ${color}; display: inline-block; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                <i class="fa-solid fa-circle" style="color: ${color}; font-size: 8px; margin-right: 3px;"></i>${device.deviceId}
            </div>
        `,
        iconSize: [60, 50],
        iconAnchor: [30, 25]
    });

    marker.setIcon(icon);
    if (marker.isPopupOpen()) {
        marker.setPopupContent(generatePopupContent(device));
    } else {
        marker.bindPopup(generatePopupContent(device));
    }
}

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

// Stubs for startSimulation/stopSimulation used in uiManager (will handle via setTrackingMode now)
export function startSimulation() { setTrackingMode('simulation'); }
export function stopSimulation() { }
export function startLiveTracking() { setTrackingMode('iot'); }
export function stopLiveTracking() { }
export function resetCow() { }
