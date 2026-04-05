const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Models
const DeviceData = require('./models/DeviceData');
const Alert = require('./models/Alert');
const SavedFence = require('./models/SavedFence');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'geofence_data.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve the static simulator files

// Connect to MongoDB
let lastConnectionError = null;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/geofence';
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    lastConnectionError = null;
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
    lastConnectionError = err.message;
  });

// Initial data if file doesn't exist
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ type: "none" }, null, 2));
}

// ---------------------------------------------------------------------------
// OLD GEOFENCE APIs (Used by Simulator to set/get global fence)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// NEW IOT TRACKING APIs
// ---------------------------------------------------------------------------

/**
 * POST /api/device-data
 * Ingests data from ESP32/IoT devices.
 */
app.post('/api/device-data', async (req, res) => {
    try {
        const { deviceId, lat, lng, status, battery } = req.body;

        if (!deviceId || lat == null || lng == null || !status) {
            return res.status(400).json({ error: "Missing required fields (deviceId, lat, lng, status)" });
        }

        const batteryLevel = battery != null ? battery : 100; // Default to 100 if missing

        // Save location data
        const deviceData = new DeviceData({
            deviceId,
            lat,
            lng,
            status,
            battery: batteryLevel
        });
        await deviceData.save();

        // Alert Engine: If OUTSIDE, create an alert
        if (status === 'OUTSIDE') {
            const alert = new Alert({
                deviceId,
                lat,
                lng,
                message: `Device ${deviceId} has breached the active geofence.`
            });
            await alert.save();
        }

        res.status(201).json({ message: "Data logged successfully", success: true });
    } catch (err) {
        console.error("Error saving device data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * GET /api/latest
 * Get the latest known locations for ALL active devices.
 */
app.get('/api/latest', async (req, res) => {
    try {
        // Aggregate to find the latest record per deviceId
        const latestData = await DeviceData.aggregate([
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: "$deviceId",
                    latestRecord: { $first: "$$ROOT" }
                }
            },
            { $replaceRoot: { newRoot: "$latestRecord" } }
        ]);

        res.json(latestData);
    } catch (err) {
        console.error("Error fetching latest devices:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * GET /api/latest/:deviceId
 * Get the latest known location for a SPECIFIC device.
 */
app.get('/api/latest/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const latestData = await DeviceData.findOne({ deviceId }).sort({ timestamp: -1 });
        
        if (!latestData) return res.status(404).json({ error: "Device not found" });

        res.json(latestData);
    } catch (err) {
        console.error(`Error fetching latest for ${req.params.deviceId}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * GET /api/history/:deviceId
 * Get the past movement for a SPECIFIC device.
 */
app.get('/api/history/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const limit = parseInt(req.query.limit) || 100; // default 100 points
        const history = await DeviceData.find({ deviceId })
            .sort({ timestamp: -1 })
            .limit(limit);

        res.json(history);
    } catch (err) {
        console.error(`Error fetching history for ${req.params.deviceId}:`, err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * GET /api/alerts
 * Get active alerts (optional extra endpoint for UI)
 */
app.get('/api/alerts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const alerts = await Alert.find({ active: true })
            .sort({ timestamp: -1 })
            .limit(limit);
        res.json(alerts);
    } catch (err) {
        console.error("Error fetching alerts:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// ---------------------------------------------------------------------------
// SAVED FENCES LIBRARY APIs
// ---------------------------------------------------------------------------

/**
 * GET /api/saved-fences
 * List all saved fences in the library.
 */
app.get('/api/saved-fences', async (req, res) => {
    try {
        const savedFences = await SavedFence.find().sort({ timestamp: -1 });
        res.json(savedFences);
    } catch (err) {
        console.error("Error fetching saved fences:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * POST /api/saved-fences
 * Save a new fence to the library.
 */
app.post('/api/saved-fences', async (req, res) => {
    try {
        const { name, data } = req.body;
        if (!name || !data) {
            return res.status(400).json({ error: "Name and data are required" });
        }
        const newFence = new SavedFence({ name, data });
        await newFence.save();
        res.status(201).json(newFence);
    } catch (err) {
        console.error("Error saving fence to library:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

/**
 * DELETE /api/saved-fences/:id
 * Delete a fence from the library.
 */
app.delete('/api/saved-fences/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await SavedFence.findByIdAndDelete(id);
        res.json({ message: "Fence deleted from library" });
    } catch (err) {
        console.error("Error deleting saved fence:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        database: mongoose.connection.readyState === 1 ? 'CONNECTED' : 'DISCONNECTED',
        dbState: mongoose.connection.readyState,
        error: lastConnectionError,
        env: process.env.NODE_ENV || 'production'
    });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
    console.log(`ESP32 Device Data Ingest: POST http://localhost:${PORT}/api/device-data`);
});
