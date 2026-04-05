const mongoose = require('mongoose');

const savedFenceSchema = new mongoose.Schema({
    name: { type: String, required: true },
    data: { type: Object, required: true }, // The simplified JSON format
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SavedFence', savedFenceSchema);
