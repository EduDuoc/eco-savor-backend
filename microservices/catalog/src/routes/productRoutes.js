const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authMiddleware } = require('../middlewares/auth');
const requireRole = require('../middlewares/roles');
const requireOwnership = require('../middlewares/ownership');

/**
 * Rutas de productos
 * GET: Público (cualquiera puede ver productos)
 * POST/PUT/DELETE: Requiere auth + rol restaurant + ownership
 */

// CREATE - Solo restaurants, auto-asigna restaurantId
router.post('/', 
  authMiddleware,
  requireRole('restaurant'),
  requireOwnership, 
  productController.createProduct
);

// READ - Todos pueden ver productos (invitados y usuarios)
router.get('/', productController.listProducts);

// Rutas para restaurante autenticado - Requiere auth + rol restaurant
// DEBE IR ANTES de /:id para que no lo capture como parámetro
router.get('/my-products',
  authMiddleware,
  requireRole('restaurant'),
  productController.getMyProducts
);

// READ - Obtener producto por ID (va DESPUÉS de rutas específicas)
router.get('/:id', productController.getProductById);

// UPDATE - Solo el dueño del producto
router.put('/:id', 
  authMiddleware,
  requireRole('restaurant'),
  requireOwnership, 
  productController.updateProduct
);

// DELETE - Solo el dueño del producto
router.delete('/:id', 
  authMiddleware,
  requireRole('restaurant'),
  requireOwnership, 
  productController.deleteProduct
);

// Rutas de stock - Solo el dueño del producto
router.put('/:id/stock', 
  authMiddleware,
  requireRole('restaurant'),
  requireOwnership, 
  productController.updateStock
);
router.put('/:id/unavailable', 
  authMiddleware,
  requireRole('restaurant'),
  requireOwnership, 
  productController.markAsUnavailable
);

// Rutas por restaurante - Público
router.get('/restaurants/:restaurantId/products', productController.getProductsByRestaurant);

// Rutas por categoría - Público
router.get('/categories/:category/products', productController.getProductsByCategory);

// Rutas INTERNAS de stock (solo para orders service con API key)
router.put('/:id/deductStock', productController.deductStock);
router.put('/:id/restoreStock', productController.restoreStock);

module.exports = router;
