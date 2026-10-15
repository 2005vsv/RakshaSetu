const mongoose = require("mongoose");

const TripSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  startPoint: { type: String, default: "", trim: true },
  destination: { type: String, required: true, trim: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, default: null },
  modeOfTravel: { type: String, default: "other" },
  description: { type: String, default: "" },
  additionalDestinations: [{ type: String, trim: true }],
  status: { type: String, enum: ["planned", "active", "completed"], default: "active" }
}, { timestamps: true });

module.exports = mongoose.model("Trip", TripSchema);
