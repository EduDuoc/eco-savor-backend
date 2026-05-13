const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  discountPrice: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  restaurantId: {
    type: String,
    required: true
  },
  restaurantName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['panadería', 'comida caliente', 'bebidas', 'postres', 'otros']
  },
  images: [{
    type: String
  }],
  available: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date
  }
}, {
  timestamps: true
});

productSchema.index({ restaurantId: 1, available: 1 });
productSchema.index({ category: 1, available: 1 });

// Validación: el precio con descuento debe ser menor al precio original
productSchema.pre('save', async function() {
  if (this.discountPrice >= this.price) {
    throw new Error('El precio con descuento debe ser menor al precio original');
  }
});

module.exports = mongoose.model('Product', productSchema);
