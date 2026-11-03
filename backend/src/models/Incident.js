const mongoose = require("mongoose");

const IncidentSchema = new mongoose.Schema({
  incidentRef: { type: String, required: true, unique: true, index: true },
  dedupeKey: { type: String, unique: true, sparse: true },
  tourist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  kind: { type: String, enum: ["sos", "safety"], default: "sos" },
  severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "high" },
  message: { type: String, required: true, maxlength: 1000 },
  status: { type: String, enum: ["new", "acknowledged", "assigned", "responding", "resolved", "cancelled"], default: "new", index: true },
  location: { latitude: { type: Number, min: -90, max: 90 }, longitude: { type: Number, min: -180, max: 180 }, accuracy: Number, recordedAt: Date },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  assignedName: { type: String, default: "" },
  assignedPolice: [{
    officer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true },
    badge: { type: String, default: "" },
    station: { type: String, default: "" },
    phone: { type: String, default: "" },
    status: {
      type: String,
      enum: ["assigned", "en_route", "arrived", "resolved"],
      default: "assigned"
    },
    assignedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date },
    etaMinutes: { type: Number, default: 5 },
    policeNote: { type: String, default: "" }
  }],
  policeConfirmed: { type: Boolean, default: false },
  policeConfirmationMessage: { type: String, default: "" },
  policeConfirmedAt: { type: Date },
  linkedEfir: { type: mongoose.Schema.Types.ObjectId, ref: "Efir" },
  resolution: { type: String, default: "", maxlength: 2000 },
  history: [{ status: String, note: { type: String, default: "" }, actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, actorName: String, at: { type: Date, default: Date.now } }],
}, { timestamps: true });

IncidentSchema.index({ tourist: 1, createdAt: -1 });
module.exports = mongoose.model("Incident", IncidentSchema);
