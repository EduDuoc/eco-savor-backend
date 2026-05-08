const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// Rutas principales de órdenes
router.post('/', orderController.createOrder);
router.get('/', orderController.listOrders);
router.get('/:id', orderController.getOrderById);
router.put('/:id', orderController.updateOrder);
router.delete('/:id', orderController.deleteOrder);

// Ruta de estado
router.put('/:id/status', orderController.updateOrderStatus);

// Rutas de acciones específicas
router.post('/:id/confirm', orderController.confirmOrder);
router.post('/:id/preparing', orderController.markAsPreparing);
router.post('/:id/ready', orderController.markAsReady);
router.post('/:id/complete', orderController.completeOrder);
router.post('/:id/cancel', orderController.cancelOrder);

// Rutas por usuario
router.get('/users/:userId/orders', orderController.getOrdersByUser);

// Rutas por restaurante
router.get('/restaurants/:restaurantId/orders', orderController.getOrdersByRestaurant);

module.exports = router;
