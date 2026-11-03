const express = require('express');
const router = express.Router();
const Anomaly = require('../models/Anomaly');
const anomalyDetectionService = require('../services/anomalyDetectionService');
const auth = require('../middleware/auth');

/**
 * GET /anomalies/stats
 * Overview summary metrics for the Admin Dashboard header
 */
router.get('/stats', auth, async (_req, res) => {
  try {
    // Automatically ensure demo anomalies are populated if DB has 0 items
    const count = await Anomaly.countDocuments();
    if (count === 0) {
      await anomalyDetectionService.seedDemoAnomalies();
    }

    const [total, pending, highPriority, underReview, resolved] = await Promise.all([
      Anomaly.countDocuments(),
      Anomaly.countDocuments({ status: 'Pending' }),
      Anomaly.countDocuments({ $or: [{ priority: 'High priority' }, { priority: 'Critical' }, { status: 'High priority' }] }),
      Anomaly.countDocuments({ status: 'Under review' }),
      Anomaly.countDocuments({ status: { $in: ['Resolved', 'Verified', 'False positive'] } }),
    ]);

    res.json({
      success: true,
      stats: {
        total,
        pending,
        highPriority,
        underReview,
        resolved,
        modelType: 'Isolation Forest (iForest)',
        ensembleSize: 100,
        subsampleSize: 64,
        featuresTracked: ['Speed', 'Acceleration', 'Bearing Angle', 'Route Offset', 'Inactivity Time'],
      },
    });
  } catch (error) {
    console.error('Anomaly stats error:', error);
    res.status(500).json({ success: false, error: 'Could not fetch anomaly stats' });
  }
});

/**
 * GET /anomalies
 * List anomaly alerts with query filter
 */
router.get('/', auth, async (req, res) => {
  try {
    // If no anomalies exist, seed the initial set
    const initialCount = await Anomaly.countDocuments();
    if (initialCount === 0) {
      await anomalyDetectionService.seedDemoAnomalies();
    }

    const { status, type, priority, search } = req.query;
    const filter = {};

    if (status && status !== 'all') {
      filter.status = status;
    }
    if (type && type !== 'all') {
      filter.anomalyType = type;
    }
    if (priority && priority !== 'all') {
      filter.priority = priority;
    }

    if (search) {
      const regex = new RegExp(search.trim(), 'i');
      filter.$or = [
        { touristCode: regex },
        { touristName: regex },
        { anomalyTypeLabel: regex },
        { details: regex },
        { zoneName: regex },
      ];
    }

    const anomalies = await Anomaly.find(filter)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      count: anomalies.length,
      anomalies,
    });
  } catch (error) {
    console.error('List anomalies error:', error);
    res.status(500).json({ success: false, error: 'Could not retrieve anomaly list' });
  }
});

/**
 * GET /anomalies/:id
 * Retrieve full anomaly details including historical GPS breadcrumbs
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const anomaly = await Anomaly.findById(req.params.id)
      .populate('tourist', 'name email phone digitalId')
      .populate('geofenceZone', 'name zone_type description')
      .lean();

    if (!anomaly) {
      return res.status(404).json({ success: false, error: 'Anomaly record not found' });
    }

    res.json({ success: true, anomaly });
  } catch (error) {
    console.error('Get anomaly detail error:', error);
    res.status(500).json({ success: false, error: 'Could not fetch anomaly details' });
  }
});

/**
 * PUT /anomalies/:id/status
 * Update verification / resolution status
 */
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, resolutionNotes } = req.body;
    const allowed = ['Pending', 'Under review', 'High priority', 'Verified', 'Resolved', 'False positive'];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: `Invalid status. Allowed: ${allowed.join(', ')}` });
    }

    const updates = {
      status,
      resolutionNotes: resolutionNotes || '',
      resolvedBy: req.user?.id || null,
      resolvedAt: ['Resolved', 'False positive', 'Verified'].includes(status) ? new Date() : null,
    };

    const updated = await Anomaly.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Anomaly alert not found' });
    }

    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('anomaly:updated', updated);
    }

    res.json({ success: true, anomaly: updated });
  } catch (error) {
    console.error('Update anomaly status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update anomaly status' });
  }
});

/**
 * POST /anomalies/seed-demo
 * Manually trigger re-seed of demo anomalies for testing/presentation
 */
router.post('/seed-demo', auth, async (req, res) => {
  try {
    const force = Boolean(req.body.force);
    const result = await anomalyDetectionService.seedDemoAnomalies(force);

    const io = req.app.get('io');
    if (io) {
      io.to('admins').emit('anomaly:refresh');
    }

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Seed demo anomalies error:', error);
    res.status(500).json({ success: false, error: 'Failed to seed anomalies' });
  }
});

/**
 * POST /anomalies/evaluate
 * Evaluate arbitrary movement input through Isolation Forest engine
 */
router.post('/evaluate', auth, async (req, res) => {
  try {
    const { latitude, longitude, speed } = req.body;
    const io = req.app.get('io');

    const anomalies = await anomalyDetectionService.evaluateMovement({
      user: req.user,
      latitude: Number(latitude),
      longitude: Number(longitude),
      speed: Number(speed || 0),
      io,
    });

    res.json({
      success: true,
      evaluated: true,
      anomaliesDetected: anomalies ? anomalies.length : 0,
      anomalies,
    });
  } catch (error) {
    console.error('Evaluate movement error:', error);
    res.status(500).json({ success: false, error: 'Failed to evaluate movement' });
  }
});

module.exports = router;

