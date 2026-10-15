const mongoose = require("mongoose");

module.exports = mongoose.model("SupportRequest", new mongoose.Schema({
  tourist: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  category: { type: String, enum: ["account", "privacy", "technical", "other"], default: "other" },
  subject: { type: String, required: true, trim: true, maxlength: 160 },
  message: { type: String, required: true, trim: true, maxlength: 3000 },
  status: { type: String, enum: ["open", "in_review", "closed"], default: "open", index: true },
  response: { type: String, default: "", maxlength: 2000 },
  history: [{ status: String, note: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, at: { type: Date, default: Date.now } }],
}, { timestamps: true }));
