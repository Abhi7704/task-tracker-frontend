const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const auth    = require('../middleware/auth');
const User    = require('../models/User');

// ─────────────────────────────────────
// POST /api/staff — Add staff (HR Admin only)
// ─────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'hr_admin')
      return res.status(403).json({ message: 'Only HR Admin can add staff.' });

    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'Please fill all fields.' });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ message: 'Email already registered.' });

    const hashed = await bcrypt.hash(password, 10);
    const staff  = await User.create({ name, email, password: hashed, role: 'staff' });

    res.status(201).json({ id: staff._id, name: staff.name, email: staff.email, role: staff.role });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// GET /api/staff — Get all staff (Manager + HR Admin)
// ─────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'hr_admin')
      return res.status(403).json({ message: 'Access denied.' });

    const staff = await User.find({ role: 'staff' }).select('-password');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// GET /api/staff/colleagues — for staff delegation
// ─────────────────────────────────────
router.get('/colleagues', auth, async (req, res) => {
  try {
    const staff = await User.find({
      role: 'staff',
      _id: { $ne: req.user.id }
    }).select('-password');
    res.json(staff);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// DELETE /api/staff/:id — Remove staff (HR Admin only)
// ─────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'hr_admin')
      return res.status(403).json({ message: 'Only HR Admin can remove staff.' });

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Staff member removed.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// PATCH /api/staff/:id/reset-password — HR Admin resets password
// ─────────────────────────────────────
router.patch('/:id/reset-password', auth, async (req, res) => {
  try {
    if (req.user.role !== 'hr_admin')
      return res.status(403).json({ message: 'Only HR Admin can reset passwords.' });

    const { newPassword } = req.body;
    if (!newPassword)
      return res.status(400).json({ message: 'Please provide a new password.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await User.findByIdAndUpdate(req.params.id, { password: hashed });

    res.json({ message: 'Password reset successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;