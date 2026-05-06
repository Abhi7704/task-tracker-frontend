const express      = require('express');
const router       = express.Router();
const auth         = require('../middleware/auth');
const Notification = require('../models/Notification');

// ─────────────────────────────────────
// GET /api/notifications
// Get notifications for logged-in user
// ─────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// PATCH /api/notifications/read-all
// Mark all notifications as read
// ─────────────────────────────────────
router.patch('/read-all', auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.id, read: false },
      { read: true }
    );
    res.json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// GET /api/notifications/unread-count
// Get count of unread notifications
// ─────────────────────────────────────
router.get('/unread-count', auth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user.id,
      read: false
    });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;