const mongoose = require("mongoose");

module.exports = mongoose.model("Zone", new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, default: "", maxlength: 1000 },
  zone_type: { type: String, enum: ["safe", "risky", "restricted"], required: true },
  geometry: { type: mongoose.Schema.Types.Mixed, required: true },
  is_active: { type: Boolean, default: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true }));
