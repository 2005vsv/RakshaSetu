const mongoose = require("mongoose");

const LocationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  accuracy: { type: Number, default: null },
  speed: { type: Number, default: null },
  recordedAt: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

module.exports = mongoose.model("Location", LocationSchema);
