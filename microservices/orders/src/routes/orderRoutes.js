const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authMiddleware } = require('../middlewares/auth');
const requireRole = require('../middlewares/roles');

/**
 * Rutas de órdenes
 * Todas requieren auth (ya aplicado en index.js)
 * Las rutas se protegen según el rol requerido
 */

// CREATE - Solo buyers pueden crear órdenes
router.post('/', 
  requireRole('buyer'), 
  orderController.createOrder
);

// READ - Listar órdenes (filtrado por rol en el controller)
router.get('/', orderController.listOrders);

// READ - Estadísticas de un restaurante (solo admin)
router.get('/restaurants/:restaurantId/stats', orderController.getRestaurantStats);

// READ - Estadísticas de un cliente (solo admin)
router.get('/customers/:userId/stats', orderController.getCustomerStats);

// READ - Obtener orden por ID
router.get('/:id', orderController.getOrderById);

// UPDATE - Solo restaurants pueden actualizar órdenes
router.put('/:id', 
  requireRole('restaurant'), 
  orderController.updateOrder
);

// DELETE - Solo cancelar (usar cancelOrder en su lugar)
router.delete('/:id', 
  requireRole('restaurant'), 
  orderController.deleteOrder
);

// UPDATE STATUS - Solo restaurants
router.put('/:id/status', 
  requireRole('restaurant'), 
  orderController.updateOrderStatus
);

// ACCIONES - Confirmar, preparar, lista, completar - Solo restaurants
router.post('/:id/confirm', 
  requireRole('restaurant'), 
  orderController.confirmOrder
);
router.post('/:id/preparing', 
  requireRole('restaurant'), 
  orderController.markAsPreparing
);
router.post('/:id/ready', 
  requireRole('restaurant'), 
  orderController.markAsReady
);
router.post('/:id/complete', 
  requireRole('restaurant'), 
  orderController.completeOrder
);

// CANCELAR - Buyers pueden cancelar sus órdenes, restaurants las de su restaurante
router.post('/:id/cancel', orderController.cancelOrder);

// Rutas por usuario - Solo el propio usuario
router.get('/users/:userId/orders', 
  requireRole('buyer'), 
  orderController.getOrdersByUser
);

// Rutas por restaurante - Solo restaurants
router.get('/restaurants/:restaurantId/orders', 
  requireRole('restaurant'), 
  orderController.getOrdersByRestaurant
);

module.exports = router;
