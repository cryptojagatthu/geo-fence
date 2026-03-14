# Geo-Fencing Simulator 🐄

A web-based simulation for livestock monitoring using geofencing. This project allows users to draw custom boundaries (Polygons, Circles) on an interactive map and simulate animal movement with real-time "Safe/Unsafe" alerts.

## 🚀 How to Run

Because this project uses **ES Modules** for better code organization, it requires a local web server to run (opening `index.html` directly will result in CORS errors).

### Option 1: Using Python (Recommended)
Mac/Linux/Windows (if Python is installed):

1.  Open your terminal.
2.  Navigate to the project folder:
    ```bash
    cd geo-fencing-simulator
    ```
    *(Note: Ensure you are inside the `geo-fencing-simulator` folder, not just the parent `Geo_fencing` folder)*

3.  Start the server:
    ```bash
    python3 -m http.server 8000
    ```

4.  Open your browser and visit:
    [http://localhost:8000](http://localhost:8000)

### Option 2: VS Code Live Server
1.  Open the project folder in **VS Code**.
2.  Install the **"Live Server"** extension.
3.  Right-click `index.html` and select **"Open with Live Server"**.

## 🌟 Features

-   **Interactive Map**: Built with Leaflet.js & OpenStreetMap.
-   **Custom Boundaries**:
    -   **Polygons**: Click points to define complex shapes.
    -   **Circles**: Click center and drag radius.
-   **Simulation Modes**:
    -   **Manual**: Drag the cow marker 🐄 with your mouse.
    -   **Auto-Walk**: Simulates random grazing movement.
    -   **Live GPS**: Uses your device's real-time location (great for mobile testing).
-   **Alert System**: Visual banner and audio alarm when the cow exits the safe zone.
-   **Data Management**: Export and Import fence data as JSON.

## 🛠️ Technical Details

### File Structure
-   `index.html`: Main entry point.
-   `css/style.css`: Modern, responsive styling with glassmorphism effects.
-   `js/`:
    -   `main.js`: App initialization.
    -   `mapManager.js`: Map setup and Search control.
    -   `fenceLogic.js`: **Ray Casting Algorithm** for Point-in-Polygon detection.
    -   `cowManager.js`: Simulation logic and GPS handling.
    -   `uiManager.js`: UI event listeners and DOM updates.
    -   `dataManager.js`: JSON file handling.

### Algorithms
1.  **Point-in-Polygon**: Uses the *Ray Casting* method to determine if a point is inside a custom polygon shape.
2.  **Point-in-Circle**: Uses the *Haversine* (or simple Euclidean for small scales) distance formula to check if the point is within the radius.

## 🔮 Future Scope
-   Integration with **ESP32 + GPS module** for real hardware tracking.
-   MQTT/WebSocket integration for live data syncing from the cloud.
-   Multi-animal tracking support.
