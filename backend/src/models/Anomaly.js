const mongoose = require("mongoose");

const AnomalySchema = new mongoose.Schema({
  tourist: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    index: true,
  },
  touristCode: {
    type: String,
    required: true,
    index: true,
    trim: true,
    default: "T001",
  },
  touristName: {
    type: String,
    required: true,
    trim: true,
    default: "Registered Tourist",
  },
  touristPhone: {
    type: String,
    default: "+91 98765 43210",
  },
  anomalyType: {
    type: String,
    required: true,
    enum: [
      "restricted_zone_entry",
      "route_deviation",
      "unusual_inactivity",
      "unusual_speed",
      "unusual_activity_concentration",
    ],
    index: true,
  },
  anomalyTypeLabel: {
    type: String,
    required: true,
    default: "Unusual movement",
  },
  anomalyScore: {
    type: Number,
    required: true,
    min: 0,
    max: 1,
    default: 0.5,
  },
  priority: {
    type: String,
    enum: ["Low priority", "Medium priority", "High priority", "Critical"],
    default: "Medium priority",
    index: true,
  },
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "medium",
  },
  status: {
    type: String,
    enum: ["Pending", "Under review", "High priority", "Verified", "Resolved", "False positive"],
    default: "Pending",
    index: true,
  },
  latestLocation: {
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    address: { type: String, default: "" },
    speed: { type: Number, default: 0 },
    recordedAt: { type: Date, default: Date.now },
  },
  previousLocations: [
    {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      speed: { type: Number, default: 0 },
      recordedAt: { type: Date, default: Date.now },
      stepNote: { type: String, default: "" },
    },
  ],
  features: {
    speedKmh: { type: Number, default: 0 },
    acceleration: { type: Number, default: 0 },
    bearingChangeDeg: { type: Number, default: 0 },
    routeOffsetMeters: { type: Number, default: 0 },
    inactivityMinutes: { type: Number, default: 0 },
    clusterEventsCount: { type: Number, default: 0 },
    isolationDepth: { type: Number, default: 0 },
  },
  details: {
    type: String,
    default: "",
    maxlength: 2000,
  },
  geofenceZone: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Zone",
    default: null,
  },
  zoneName: {
    type: String,
    default: "",
  },
  plannedRouteName: {
    type: String,
    default: "",
  },
  resolutionNotes: {
    type: String,
    default: "",
    maxlength: 1000,
  },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  resolvedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

AnomalySchema.index({ status: 1, createdAt: -1 });
AnomalySchema.index({ touristCode: 1, createdAt: -1 });

module.exports = mongoose.model("Anomaly", AnomalySchema);

