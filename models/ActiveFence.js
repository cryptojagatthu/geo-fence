const mongoose = require('mongoose');

const ActiveFenceSchema = new mongoose.Schema({
    // We only ever want one active fence, so we can use a constant key or just take the latest
    type: { type: String, default: "active" },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ActiveFence', ActiveFenceSchema);
