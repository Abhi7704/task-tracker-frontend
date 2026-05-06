const express      = require('express');
const router       = express.Router();
const auth         = require('../middleware/auth');
const Task         = require('../models/Task');
const User         = require('../models/User');
const Notification = require('../models/Notification');
const multer       = require('multer');
const crypto       = require('crypto');
const path         = require('path');
const mongoose     = require('mongoose');

// Use memory storage — pipe manually to GridFS
const upload = multer({ storage: multer.memoryStorage() });

// helper: create a notification
async function notify(userId, message, taskId) {
  await Notification.create({ userId, message, taskId });
}

// ─────────────────────────────────────
// GET /api/tasks
// ─────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const filter = req.user.role === 'manager'
  ? {}
  : { 
      $or: [
        { assignedTo: req.user.id },
        { delegatedFrom: req.user.id }
      ]
    };

   const tasks = await Task.find(filter)
  .populate('assignedTo',    'name email')
  .populate('assignedBy',    'name')
  .populate('delegatedFrom', 'name')
  .populate('delegatedTo',   'name')
  .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// POST /api/tasks
// ─────────────────────────────────────
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager')
      return res.status(403).json({ message: 'Only managers can create tasks.' });

    const { title, description, assignedTo, priority, dueDate } = req.body;
    if (!title || !description || !assignedTo || !dueDate)
      return res.status(400).json({ message: 'Please fill all fields.' });

    const task = await Task.create({
      title, description, assignedTo,
      assignedBy: req.user.id,
      priority, dueDate
    });

    const staffUser = await User.findById(assignedTo);
    await notify(assignedTo,  `📋 New task assigned: "${title}"`,                   task._id);
    await notify(req.user.id, `✅ Task created and assigned to ${staffUser?.name}`, task._id);

    const populated = await task.populate('assignedTo', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// PATCH /api/tasks/:id/status
// ─────────────────────────────────────
router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not your task.' });

    task.status = status;
    if (status === 'completed') task.completedAt = Date.now();
    await task.save();

    const manager = await User.findOne({ role: 'manager' });
    if (manager) {
      const verb = status === 'pending' ? 'started working on' : 'completed';
      await notify(manager._id, `${req.user.name} ${verb}: "${task.title}"`, task._id);
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// PATCH /api/tasks/:id/reassign
// ─────────────────────────────────────
router.patch('/:id/reassign', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager')
      return res.status(403).json({ message: 'Only managers can reassign tasks.' });

    const { assignedTo } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    const oldStaffId = task.assignedTo;
    task.assignedTo  = assignedTo;
    task.status      = 'assigned';
    await task.save();

    const newStaff = await User.findById(assignedTo);
    const oldStaff = await User.findById(oldStaffId);

    await notify(assignedTo,  `📋 Task reassigned to you: "${task.title}"`,                                task._id);
    await notify(oldStaffId,  `↔ Task reassigned away from you: "${task.title}"`,                          task._id);
    await notify(req.user.id, `↔ Reassigned "${task.title}" from ${oldStaff?.name} to ${newStaff?.name}`, task._id);

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// DELETE /api/tasks/:id
// ─────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager')
      return res.status(403).json({ message: 'Only managers can delete tasks.' });

    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    await notify(req.user.id, `🗑 Task deleted: "${task.title}"`, task._id);
    res.json({ message: 'Task deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// POST /api/tasks/:id/upload
// ─────────────────────────────────────
router.post('/:id/upload', auth, upload.single('file'), async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not your task.' });

    if (!req.file) return res.status(400).json({ message: 'No file uploaded.' });

    // Generate unique filename
    const filename = crypto.randomBytes(16).toString('hex') +
                     path.extname(req.file.originalname);

    // Upload to GridFS using native driver
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'taskfiles'
    });

    const uploadStream = bucket.openUploadStream(filename, {
  metadata: { 
    originalname: req.file.originalname,
    contentType:  req.file.mimetype
  }
});

    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', async () => {
      try {
        const doc = {
  name:       req.file.originalname,
  url:        `/files/${filename}`,  // ← store only relative path
  uploadedAt: Date.now()
};
        task.documents.push(doc);
        await task.save();
        res.json({ message: 'File uploaded successfully.', document: doc });
      } catch (err) {
        res.status(500).json({ message: 'Save failed', error: err.message });
      }
    });

    uploadStream.on('error', (err) => {
      res.status(500).json({ message: 'Upload failed', error: err.message });
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─────────────────────────────────────
// DELETE /api/tasks/:id/documents/:docId
// ─────────────────────────────────────
router.delete('/:id/documents/:docId', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    if (req.user.role === 'staff' && task.assignedTo.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not your task.' });

    const doc = task.documents.find(d => d._id.toString() === req.params.docId);

    // Delete from GridFS
    if (doc) {
      const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'taskfiles'
      });
      const filename = doc.url.split('/files/')[1];
      const file = await mongoose.connection.db
        .collection('taskfiles.files')
        .findOne({ filename });
      if (file) await bucket.delete(file._id);
    }

    task.documents = task.documents.filter(
      d => d._id.toString() !== req.params.docId
    );
    await task.save();

    res.json({ message: 'Document deleted.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


// ─────────────────────────────────────
// PATCH /api/tasks/:id/delegate
// Staff: delegate task to another staff
// ─────────────────────────────────────
router.patch('/:id/delegate', auth, async (req, res) => {
  try {
    if (req.user.role !== 'staff')
      return res.status(403).json({ message: 'Only staff can delegate tasks.' });

    const { delegateTo } = req.body;
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found.' });

    if (task.assignedTo.toString() !== req.user.id)
      return res.status(403).json({ message: 'You can only delegate your own tasks.' });

    const newStaff = await User.findById(delegateTo);
    if (!newStaff) return res.status(404).json({ message: 'Staff not found.' });

    task.delegatedFrom = task.assignedTo;
    task.delegatedTo   = delegateTo;
    task.assignedTo    = delegateTo;
    task.status        = 'delegated';
    await task.save();

    // Notify new staff
    await notify(delegateTo, `📋 Task delegated to you by ${req.user.name}: "${task.title}"`, task._id);

    // Notify manager
    const manager = await User.findOne({ role: 'manager' });
    if (manager) {
      await notify(manager._id, `↔ ${req.user.name} delegated "${task.title}" to ${newStaff.name}`, task._id);
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});


module.exports = router;