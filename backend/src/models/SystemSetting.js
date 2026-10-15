const mongoose = require("mongoose");

module.exports = mongoose.model("SystemSetting", new mongoose.Schema({
  key: { type: String, default: "global", unique: true },
  locationRetentionDays: { type: Number, min: 0, max: 3650, default: 0 },
  incidentRetentionDays: { type: Number, min: 0, max: 3650, default: 0 },
  alertRetentionDays: { type: Number, min: 0, max: 3650, default: 0 },
  auditRetentionDays: { type: Number, min: 0, max: 3650, default: 0 },
  alertSoundEnabled: { type: Boolean, default: false },
  criticalSeverityThreshold: { type: String, enum: ["medium", "high", "critical"], default: "high" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true }));
