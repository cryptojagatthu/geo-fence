/**
 * Cow Manager
 * Handles the cow marker, movement events, and collision detection loop.
 */

import { isPointInFence } from './fenceLogic.js';
import { updateStatus, updateCoords } from './uiManager.js';

let cowMarker;
let autoWalkInterval;
const WALKING_SPEED_MS = 1000;
const STEP_SIZE = 0.00015; // Rough lat/lng step size

// --- Live GPS Mode ---
let watchId = null;
let mapInstance; // Store map reference

export function setupCow(map) {
    mapInstance = map; // Capture map instance
    // Initial position (center of map)
    const startPos = map.getCenter();

    // Custom Icon
    const cowIcon = L.divIcon({
        className: 'custom-cow-icon',
        html: '<div style="font-size: 32px; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));">🐄</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
    });

    cowMarker = L.marker(startPos, {
        draggable: true,
        icon: cowIcon
    }).addTo(map);

    // Event: Dragging
    cowMarker.on('drag', () => {
        checkPosition();
    });

    // Event: Drag End
    cowMarker.on('dragend', () => {
        checkPosition();
    });

    checkPosition(); // Initial check
}

// --- Simulation Mode ---
export function startSimulation() {
    if (autoWalkInterval) return;

    // Disable Live GPS if active
    stopLiveTracking();

    console.log('Auto-Walk Started');
    autoWalkInterval = setInterval(() => {
        moveCowRandomly();
    }, WALKING_SPEED_MS);
}

export function stopSimulation() {
    if (autoWalkInterval) {
        clearInterval(autoWalkInterval);
        autoWalkInterval = null;
        console.log('Auto-Walk Stopped');
    }
}



export function startLiveTracking() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    // Stop random walk if active
    stopSimulation();

    // Reset toggle UI for simulation (will be handled in UI manager, but good to be safe)

    const options = {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    };

    console.log("Starting Live Tracking...");

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            console.log(`GPS Update: ${latitude}, ${longitude} (Acc: ${accuracy}m)`);

            const newLatLng = [latitude, longitude];

            if (cowMarker) {
                cowMarker.setLatLng(newLatLng);
                if (mapInstance) { // Ensure mapInstance is available
                    mapInstance.setView(newLatLng, 18); // Keep map centered on user
                }
                checkPosition();
            }
        },
        (error) => {
            console.warn(`ERROR(${error.code}): ${error.message}`);
            alert(`GPS Error: ${error.message}`);
            // Optionally auto-toggle off logic here
        },
        options
    );
}

export function stopLiveTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
        console.log("Live Tracking Stopped");
    }
}

function moveCowRandomly() {
    if (!cowMarker) return;

    const currentLatLng = cowMarker.getLatLng();
    const latDelta = (Math.random() - 0.5) * STEP_SIZE;
    const lngDelta = (Math.random() - 0.5) * STEP_SIZE;

    const newLatLng = [currentLatLng.lat + latDelta, currentLatLng.lng + lngDelta];

    cowMarker.setLatLng(newLatLng);

    // Pan map if cow gets too close to edge? Optional.

    checkPosition();
}

export function resetCow(map) {
    cowMarker.setLatLng(map.getCenter());
    checkPosition();
}

function checkPosition() {
    const pos = cowMarker.getLatLng();
    const isSafe = isPointInFence(pos.lat, pos.lng);

    updateCoords(pos.lat, pos.lng);
    updateStatus(isSafe);
}
