const mongoose = require("mongoose");

module.exports = mongoose.model("Announcement", new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 160 },
  body: { type: String, required: true, trim: true, maxlength: 5000 },
  severity: { type: String, enum: ["info", "warning", "urgent"], default: "info" },
  published: { type: Boolean, default: true, index: true },
  author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true }));
