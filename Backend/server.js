const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
require('dotenv').config();

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/staff',         require('./routes/staff'));
app.use('/api/notifications', require('./routes/notifications'));

// ─────────────────────────────────────
// GridFS File Serving
// ─────────────────────────────────────
app.get('/files/:filename', async (req, res) => {
  try {
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'taskfiles'
    });

    const files = await mongoose.connection.db
      .collection('taskfiles.files')
      .findOne({ filename: req.params.filename });

    if (!files) return res.status(404).json({ message: 'File not found' });

    // Get content type from metadata or file
    const contentType = files.metadata?.contentType ||
                        files.contentType ||
                        'application/octet-stream';


    res.set('Content-Type', contentType);

    // Open inline for PDF and images, download for others
    if (contentType === 'application/pdf' || contentType.startsWith('image/')) {
      res.set('Content-Disposition', `inline; filename="${files.metadata?.originalname || files.filename}"`);
    } else {
      res.set('Content-Disposition', `attachment; filename="${files.metadata?.originalname || files.filename}"`);
    }

    bucket.openDownloadStreamByName(req.params.filename).pipe(res);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Connect MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    const PORT = process.env.PORT || 5007;
    app.listen(PORT, '0.0.0.0', () =>
      console.log(`🚀 Server running on port ${PORT}`)
    );
  })
  .catch(err => {
    console.error('❌ MongoDB error:', err);
    process.exit(1);
  });
