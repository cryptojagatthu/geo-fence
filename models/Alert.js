const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    deviceId: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    active: { type: Boolean, default: true } // Active until marked resolved, if needed
});

alertSchema.index({ deviceId: 1, timestamp: -1 });

module.exports = mongoose.model('Alert', alertSchema);
