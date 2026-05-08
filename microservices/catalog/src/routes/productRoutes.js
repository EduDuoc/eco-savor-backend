const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// Rutas de productos
router.post('/', productController.createProduct);
router.get('/', productController.listProducts);
router.get('/:id', productController.getProductById);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

// Rutas de stock
router.put('/:id/stock', productController.updateStock);
router.put('/:id/unavailable', productController.markAsUnavailable);

// Rutas por restaurante
router.get('/restaurants/:restaurantId/products', productController.getProductsByRestaurant);

// Rutas por categoría
router.get('/categories/:category/products', productController.getProductsByCategory);

module.exports = router;
