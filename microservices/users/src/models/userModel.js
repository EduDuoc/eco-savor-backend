const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['restaurant', 'buyer'],
    required: true
  },
  restaurantName: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  phone: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Validación: si es restaurante, debe tener nombre
userSchema.pre('save', function(next) {
  if (this.role === 'restaurant' && !this.restaurantName) {
    throw new Error('El restaurante debe tener un nombre');
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
