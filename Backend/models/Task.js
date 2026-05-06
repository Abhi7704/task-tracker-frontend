const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title:         { type: String, required: true },
  description:   { type: String, required: true },
  assignedTo:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  priority:      { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
  status:        { type: String, enum: ['assigned', 'delegated', 'pending', 'completed'], default: 'assigned' },
  dueDate:       { type: Date },
  completedAt:   { type: Date, default: null },
  delegatedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  delegatedTo:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  documents:     [{ 
    name:       String, 
    url:        String,
    uploadedAt: { type: Date, default: Date.now }
  }],
  createdAt:     { type: Date, default: Date.now }
});

module.exports = mongoose.model('Task', taskSchema);