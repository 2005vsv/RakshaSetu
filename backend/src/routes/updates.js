const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');

// Current official release configuration
const APP_RELEASE_CONFIG = {
  latestVersion: '1.0.1',
  latestVersionCode: 2,
  minSupportedVersion: '1.0.0',
  title: 'RakshaSetu v1.0.1 Update Available',
  releaseDate: 'November 2026',
  releaseNotes: [
    '⌨️ Keyboard Auto-Scroll: Password & trip planning inputs never hidden.',
    '🗺️ Place Search Autocomplete: Real-time destination suggestions.',
    '📱 3-Button Navigation: Full clearance above phone navigation bar.',
    '🤖 Enhanced Raksha AI: Math calculations & general knowledge.',
    '📴 Direct Offline SMS: Direct 1-tap message to emergency contacts.'
  ],
  downloadUrl: 'https://github.com/2005vsv/RakshaSetu/releases/download/v1.0.1/RakshaSetu.apk',
  releasePageUrl: 'https://github.com/2005vsv/RakshaSetu/releases/tag/v1.0.1',
  forceUpdate: false,
};

/**
 * GET /updates/check
 * Returns the latest version info and download link
 */
router.get('/check', (_req, res) => {
  res.json({
    success: true,
    ...APP_RELEASE_CONFIG,
  });
});

/**
 * POST /updates/broadcast
 * Broadcasts an app update notification to all connected tourists
 */
router.post('/broadcast', async (req, res) => {
  try {
    const io = req.app.get('io');
    const updatePayload = {
      ...APP_RELEASE_CONFIG,
      broadcastedAt: new Date().toISOString(),
    };

    // 1. Broadcast over Socket.IO to all connected mobile clients
    if (io) {
      io.emit('app:update', updatePayload);
      io.emit('announcement:new', {
        title: '🚀 RakshaSetu v1.0.1 Update Available',
        message: 'A new update with keyboard fixes, place search suggestions, and enhanced AI is ready. Tap to download!',
        severity: 'info',
        createdAt: new Date().toISOString(),
      });
    }

    // 2. Also record in Announcements collection for persistence
    try {
      await Announcement.create({
        title: '🚀 RakshaSetu App Update Available (v1.0.1)',
        message: 'New release v1.0.1 is available with keyboard fixes, place search suggestions & AI upgrades. Please update your app.',
        category: 'general',
        isActive: true,
      });
    } catch (_) {}

    res.json({
      success: true,
      message: 'App update notification successfully broadcast to all mobile users.',
      updatePayload,
    });
  } catch (error) {
    console.error('Update broadcast error:', error);
    res.status(500).json({ success: false, error: 'Could not broadcast update' });
  }
});

module.exports = router;

