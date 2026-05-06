const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  email:     { type: String, required: true, unique: true, lowercase: true },
  password:  { type: String, required: true },
  role: { type: String, enum: ['manager', 'hr_admin', 'staff'], default: 'staff' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);