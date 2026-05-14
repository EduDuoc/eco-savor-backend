const Product = require('../models/productModel');

/**
 * Middleware de validación de ownership para productos
 * Simplificado para evitar timeouts
 */
const requireOwnership = async (req, res, next) => {
  try {
    if (!req.user || !req.user.sub) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado. Por favor inicie sesión.'
      });
    }

    const userId = req.user.sub;

    // Para CREATE: solo asignar restaurantId del usuario
    if (req.method === 'POST') {
      req.body.restaurantId = userId;
      console.log('Creating product for restaurant:', userId);
      return next();
    }

    // Para UPDATE/DELETE: validar ownership
    const productId = req.params.id;
    const product = await Product.findById(productId).select('restaurantId');

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    if (product.restaurantId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No tiene permiso para modificar este producto'
      });
    }

    next();
  } catch (error) {
    console.error('Error en requireOwnership:', error);
    res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
};

module.exports = requireOwnership;
