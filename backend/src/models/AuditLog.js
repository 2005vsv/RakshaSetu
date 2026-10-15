const mongoose = require("mongoose");

module.exports = mongoose.model("AuditLog", new mongoose.Schema({
  actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  action: { type: String, required: true, index: true },
  targetType: String,
  targetId: String,
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
  createdAt: { type: Date, default: Date.now, index: true },
}));
