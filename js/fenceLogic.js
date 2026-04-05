/**
 * Fence Logic
 * Handles drawing, storage, and geometric calculations.
 */

export const drawnItems = new L.FeatureGroup();
let drawControl;

export function setupFenceControls(map) {
    map.addLayer(drawnItems);

    // Initialize the Draw Control (hidden, strictly for logic if needed, or we use handlers directly)
    // We will use programmatic handlers for custom buttons

    // Event Handlers for Draw Creation
    map.on(L.Draw.Event.CREATED, (e) => {
        // Enforce single boundary: Clear any existing before adding new
        drawnItems.clearLayers();
        
        const layer = e.layer;
        drawnItems.addLayer(layer);

        // Add edit/delete context menu or click handler if needed?
        // For now, just simplistic "Clear Frame"
    });

    // --- Bind Custom Buttons ---

    // 1. Draw Polygon
    const btnPoly = document.getElementById('btn-draw-poly');
    if (btnPoly) {
        // Create the handler
        const polyHandler = new L.Draw.Polygon(map, {
            allowIntersection: false,
            showArea: true,
            shapeOptions: {
                color: '#2563eb', // Primary Blue
                fillColor: '#2563eb',
                fillOpacity: 0.2
            }
        });

        btnPoly.addEventListener('click', () => {
            polyHandler.enable();
            console.log('Polygon Draw Enabled');
        });
    }

    // 2. Draw Circle
    const btnCircle = document.getElementById('btn-draw-circle');
    if (btnCircle) {
        const circleHandler = new L.Draw.Circle(map, {
            shapeOptions: {
                color: '#2563eb',
                fillColor: '#2563eb',
                fillOpacity: 0.2
            }
        });

        btnCircle.addEventListener('click', () => {
            circleHandler.enable();
            console.log('Circle Draw Enabled');
        });
    }
}

export function getFenceLayer() {
    return drawnItems;
}

/**
 * Checks if a point (lat, lng) is inside any of the defined fences.
 * Supports Polygons and Circles.
 */
export function isPointInFence(lat, lng) {
    let isInside = false;
    // console.log(`Checking Pos: ${lat}, ${lng}`);

    drawnItems.eachLayer(layer => {
        if (isInside) return;

        if (layer instanceof L.Polygon && !(layer instanceof L.Rectangle)) {
            // Leaflet 1+ Polygons are LatLng[][] (rings)
            const latlngs = layer.getLatLngs();

            // Check if it's nested (rings) or flat (simple polygon, though L.1.0 usually nests)
            // We assume the first ring is the outer boundary.
            let shape = latlngs;
            if (Array.isArray(latlngs) && latlngs.length > 0 && Array.isArray(latlngs[0])) {
                shape = latlngs[0];
            }

            // Console log to verify structure during debug
            // console.log("Polygon Shape:", shape);

            // Important: L.Rectangle is also an L.Polygon, but sometimes handled differently
            // We explicitly handled Rectangle below, but usually L.Draw creates L.Polygon/L.Rectangle

            if (isPointInPolygon([lat, lng], shape)) {
                isInside = true;
            }
        } else if (layer instanceof L.Circle) {
            const center = layer.getLatLng();
            const radius = layer.getRadius();
            const distance = map.distance(center, [lat, lng]);
            if (distance <= radius) {
                isInside = true;
            }
        } else if (layer instanceof L.Rectangle) {
            if (layer.getBounds().contains([lat, lng])) {
                isInside = true;
            }
        }
    });

    return isInside;
}

// Ray Casting Algorithm for Point in Polygon
// Input: point [lat, lng], vs [ [lat,lng], [lat,lng]... ]
function isPointInPolygon(point, vs) {
    // Ray-casting algorithm based on
    // https://github.com/substack/point-in-polygon

    var x = point[0], y = point[1]; // lat, lng

    var inside = false;
    for (var i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        var xi = vs[i].lat, yi = vs[i].lng;
        var xj = vs[j].lat, yj = vs[j].lng;

        var intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}
