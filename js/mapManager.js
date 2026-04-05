/**
 * Map Manager
 * Handles Leaflet initialization and tile layers.
 */

export let map;

export function initMap(containerId) {
    // Default focus: Hyderabad (from user's JSON example) or a nice scenic farm location
    const defaultCoords = [17.3850, 78.4867];

    map = L.map(containerId).setView(defaultCoords, 18);

    // High-quality OpenStreetMap Tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22
    }).addTo(map);

    // Add Search Control (Leaflet Geocoder)
    L.Control.geocoder({
        defaultMarkGeocode: false
    })
        .on('markgeocode', function (e) {
            const bbox = e.geocode.bbox;
            const poly = L.polygon([
                bbox.getSouthEast(),
                bbox.getNorthEast(),
                bbox.getNorthWest(),
                bbox.getSouthWest()
            ]);
            map.fitBounds(poly.getBounds());
        })
        .addTo(map);


    // Fix map refesh issues on resize
    setTimeout(() => {
        map.invalidateSize();
    }, 100);

    return map;
}
export function locateUser() {
    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser");
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            map.setView([latitude, longitude], 18);
            
            // Add a temporary marker for the user's location
            const userIcon = L.divIcon({
                html: '<i class="fa-solid fa-house-user" style="color: #2563eb; font-size: 24px; text-shadow: 0 0 5px white;"></i>',
                className: 'user-location-icon',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });
            
            L.marker([latitude, longitude], { icon: userIcon })
                .addTo(map)
                .bindPopup("You are here")
                .openPopup();
        },
        (error) => {
            console.error("Geolocation error:", error);
            alert("Unable to retrieve your location. Please check your browser permissions.");
        },
        { enableHighAccuracy: true }
    );
}
