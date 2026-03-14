const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'geofence_data.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve the static simulator files

// Initial data if file doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ type: "none" }, null, 2));
}

/**
 * GET /api/geofence
 * Returns the current geo-fence configuration for ESP32.
 */
app.get('/api/geofence', (req, res) => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    } catch (err) {
        console.error("Error reading geofence data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * POST /api/geofence
 * Updates the current geo-fence configuration from the simulator.
 */
app.post('/api/geofence', (req, res) => {
    try {
        const fenceData = req.body;

        // Basic validation
        if (!fenceData || !fenceData.type) {
            return res.status(400).json({ error: "Invalid fence data" });
        }

        fs.writeFileSync(DATA_FILE, JSON.stringify(fenceData, null, 2));
        console.log("Geofence updated successfully");
        res.json({ message: "Fence updated successfully", data: fenceData });
    } catch (err) {
        console.error("Error writing geofence data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`ESP32 API Endpoint: http://localhost:${PORT}/api/geofence`);
});
