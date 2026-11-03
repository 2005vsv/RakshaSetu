const mongoose = require('mongoose');

const GeoLocationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  nearestCity: { type: String }
}, { _id: false });

const EfirSchema = new mongoose.Schema({
  filedBy: { type: String, required: true },
  email: { type: String, default: "", index: true },
  description: { type: String, required: true },
  phone: { type: String, required: true },
  touristId: { type: String, required: true, index: true },
  geoLocation: { type: GeoLocationSchema, required: true },
  assignedInspector: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Inspector' },
    name: { type: String }
  },
  assignedOfficers: [{
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: { type: String },
    badge: { type: String },
    station: { type: String },
    phone: { type: String },
    status: { type: String, enum: ['assigned', 'en_route', 'arrived', 'resolved'], default: 'assigned' },
    assignedAt: { type: Date, default: Date.now },
    confirmedAt: { type: Date },
    policeNote: { type: String }
  }],
  incidentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Incident' },
  incidentRef: { type: String },
  emergencyType: { type: String, default: 'SOS Distress' },
  status: {
    type: String,
    enum: ['pending', 'verified', 'assigned', 'sent', 'rejected'],
    default: 'pending'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Efir', EfirSchema);
