const Inspector = require('../models/Inspector');
const mongoose = require('mongoose');

const defaultInspectors = [
  { name: "Inspector Rajesh Sharma (Crime Branch)", phone: "9876543210", email: "rajesh.sharma@police.gov.in", isAvailable: true },
  { name: "Inspector Priya Verma (Tourist Police)", phone: "9876543211", email: "priya.verma@police.gov.in", isAvailable: true },
  { name: "Inspector Amit Kulkarni (Rapid Action)", phone: "9876543212", email: "amit.kulkarni@police.gov.in", isAvailable: true },
  { name: "Sub-Inspector Sunita Rao (Field Response)", phone: "9876543213", email: "sunita.rao@police.gov.in", isAvailable: true }
];

exports.listAvailable = async (req, res) => {
  try {
    let items = await Inspector.find().sort({ name: 1 });
    if (!items || items.length === 0) {
      try {
        items = await Inspector.insertMany(defaultInspectors);
      } catch (_) {
        items = await Inspector.find().sort({ name: 1 });
      }
    }
    res.json(items);
  } catch (err) {
    console.error('Error fetching inspectors:', err);
    res.status(500).json({ error: 'Failed to fetch inspectors' });
  }
};
