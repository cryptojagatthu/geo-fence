const mongoose = require('mongoose');

const deviceDataSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    status: { type: String, enum: ['INSIDE', 'OUTSIDE', 'UNKNOWN'], required: true },
    battery: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
});

// Indexes for faster querying
deviceDataSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('DeviceData', deviceDataSchema);
