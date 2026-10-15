const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  sessionVersion: { type: Number, default: 0 },
  passwordResetTokenHash: { type: String, default: undefined, select: false },
  passwordResetExpires: { type: Date, default: undefined, select: false },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  adminRole: { type: String, enum: ["super_admin", "monitoring_officer", "responder"], default: "super_admin" },
  accountStatus: { type: String, enum: ["active", "suspended", "pending"], default: "active", index: true },
  verificationStatus: { type: String, enum: ["unverified", "verified", "flagged"], default: "unverified", index: true },
  flagReason: { type: String, default: "", maxlength: 500 },
  name: { type: String, default: "" },
  phone: { type: String, default: "" },
  aadhaarNumber: { type: String, default: "" },
  touristRole: { type: String, enum: ["tourist", "guide"], default: "tourist" },
  digitalId: { type: String, unique: true, sparse: true },
  emergencyContacts: [{
    name: { type: String, required: true },
    phone: { type: String, required: true },
    relation: { type: String, required: true }
  }],
  preferences: {
    notifications: { type: Boolean, default: true },
    locationSharing: { type: Boolean, default: false },
    shareWithPolice: { type: Boolean, default: true }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("User", UserSchema);
