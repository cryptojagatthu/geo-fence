/**
 * Data Manager
 * Handles Import/Export of GeoJSON.
 */

// ... existing imports ...

// Helper: Round to 6 decimal places for ESP32 precision
function toFixed6(n) {
    return Math.round(n * 1e6) / 1e6;
}

// Helper: Convert Map Layer to ESP32 Format
function getEsp32Format(layer) {
    if (layer instanceof L.Polygon && !(layer instanceof L.Rectangle)) {
        // Handle Polygon
        const latlngs = layer.getLatLngs();
        // Leaflet polygons are arrays of arrays (rings), use the first ring (outer boundary)
        let ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;

        // Convert to simplified point objects with 6 decimal precision
        let points = ring.map(p => ({
            lat: toFixed6(p.lat),
            lng: toFixed6(p.lng)
        }));

        // Remove duplicate closing point if present (Leaflet usually handles this, but good to be safe)
        if (points.length > 2) {
            const first = points[0];
            const last = points[points.length - 1];
            if (first.lat === last.lat && first.lng === last.lng) {
                points.pop();
            }
        }

        // Validation: Polygon must have at least 3 unique points
        if (points.length < 3) {
            console.warn("Invalid Polygon: Less than 3 points");
            return null;
        }

        return {
            type: "polygon",
            points: points
        };
    }
    else if (layer instanceof L.Circle) {
        // Handle Circle
        const center = layer.getLatLng();
        return {
            type: "circle",
            center: {
                lat: toFixed6(center.lat),
                lng: toFixed6(center.lng)
            },
            radiusMeters: Math.round(layer.getRadius()) // Radius in meters (integer)
        };
    }
    else if (layer instanceof L.Rectangle) {
        // Rectangle is just a 4-point polygon
        const bounds = layer.getBounds();
        const northWest = bounds.getNorthWest();
        const northEast = bounds.getNorthEast();
        const southEast = bounds.getSouthEast();
        const southWest = bounds.getSouthWest();

        const points = [northWest, northEast, southEast, southWest].map(p => ({
            lat: toFixed6(p.lat),
            lng: toFixed6(p.lng)
        }));

        return {
            type: "polygon",
            points: points
        };
    }
    return null;
}

export function exportFenceToESP32(layerGroup) {
    if (!layerGroup || layerGroup.getLayers().length === 0) {
        alert("No fences to export!");
        return null;
    }

    // Since ESP32 usually wants a single fence or a list, let's look at what the user typically draws.
    // If multiple layers, proper JSON structure would be an array.
    // However, the request example shows a single object. 
    // Let's support an Array of objects if multiple, or a single Object if one.

    const layers = layerGroup.getLayers();
    const esp32Data = layers.map(layer => getEsp32Format(layer)).filter(i => i !== null);

    if (esp32Data.length === 0) {
        alert("Export failed: No valid fences found.\n- Polygons must have at least 3 points.\n- Circles must have a valid center/radius.");
        return null;
    }

    // If only one, return object. If multiple, return array. 
    // (Or should we always return array for consistency? Let's stick to the prompt's single object style if one)
    const finalOutput = esp32Data.length === 1 ? esp32Data[0] : esp32Data;

    // Trigger Download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(finalOutput, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "fence-esp32.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    return finalOutput;
}

export function exportFence(layerGroup) {
    if (!layerGroup || layerGroup.getLayers().length === 0) {
        alert("No fences to export!");
        return;
    }

    // Convert Leaflet layer group to GeoJSON
    const geoJSON = layerGroup.toGeoJSON();

    // Create a data string
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geoJSON, null, 2));

    // Create a virtual anchor tag to trigger download
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "fence_data.json");
    document.body.appendChild(downloadAnchorNode); // Required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

export function importFence(file, map, layerGroup) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const jsonData = JSON.parse(e.target.result);

            // Clear existing
            layerGroup.clearLayers();

            // Add new layer from GeoJSON
            L.geoJSON(jsonData, {
                onEachFeature: (feature, layer) => {
                    // Re-apply styles if needed, or let Leaflet Draw handle it?
                    // L.geoJSON creates default layers. We might want to customize them 
                    // to match drawn items (blue, etc)
                    if (layer instanceof L.Path) {
                        layer.setStyle({
                            color: '#2563eb',
                            fillColor: '#2563eb',
                            fillOpacity: 0.2
                        });
                    }
                    layerGroup.addLayer(layer);
                }
            });

            // Adjust map view to fit imported fences
            if (layerGroup.getLayers().length > 0) {
                map.fitBounds(layerGroup.getBounds());
            }

            console.log("Fence Imported Successfully");

        } catch (err) {
            console.error("Error parsing JSON:", err);
            alert("Invalid JSON file");
        }
    };
    reader.readAsText(file);
}
