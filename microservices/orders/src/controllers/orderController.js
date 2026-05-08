const orderService = require('../services/orderService');

/**
 * Controller: Maneja requests HTTP de órdenes
 */

/**
 * Crear nueva orden
 * POST /api/orders
 */
exports.createOrder = async (req, res) => {
  try {
    const { orderType, scheduledTime, ...orderData } = req.body;
    
    const newOrder = await orderService.create(orderData, orderType, scheduledTime);
    
    res.status(201).json({
      success: true,
      message: 'Orden creada exitosamente',
      data: newOrder
    });
  } catch (error) {
    console.error('Error al crear orden:', error);
    
    if (error.message.includes('productos') || error.message.includes('restaurante') || error.message.includes('hora')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Obtener orden por ID
 * GET /api/orders/:id
 */
exports.getOrderById = async (req, res) => {
  try {
    const order = await orderService.getById(req.params.id);
    
    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error al obtener orden:', error);
    
    if (error.message === 'Orden no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Listar órdenes con filtros
 * GET /api/orders
 */
exports.listOrders = async (req, res) => {
  try {
    const { userId, restaurantId, status } = req.query;
    
    const filters = {};
    if (userId) filters.userId = userId;
    if (restaurantId) filters.restaurantId = restaurantId;
    if (status) filters.status = status;
    
    const orders = await orderService.list(filters);
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error al listar órdenes:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Obtener órdenes de un usuario
 * GET /api/users/:userId/orders
 */
exports.getOrdersByUser = async (req, res) => {
  try {
    const orders = await orderService.getByUser(req.params.userId);
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error al obtener órdenes del usuario:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Obtener órdenes de un restaurante
 * GET /api/restaurants/:restaurantId/orders
 */
exports.getOrdersByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { status } = req.query;
    
    const orders = await orderService.getByRestaurant(restaurantId, status || null);
    
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error al obtener órdenes del restaurante:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Actualizar estado de orden
 * PUT /api/orders/:id/status
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ success: false, error: 'El estado es requerido' });
    }
    
    const order = await orderService.updateStatus(req.params.id, status);
    
    res.json({
      success: true,
      message: `Orden ${status}`,
      data: order
    });
  } catch (error) {
    console.error('Error al actualizar estado:', error);
    
    if (error.message.includes('Estado') || error.message === 'Orden no encontrada') {
      return res.status(400).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Confirmar orden
 * POST /api/orders/:id/confirm
 */
exports.confirmOrder = async (req, res) => {
  try {
    const order = await orderService.confirm(req.params.id);
    
    res.json({
      success: true,
      message: 'Orden confirmada',
      data: order
    });
  } catch (error) {
    console.error('Error al confirmar orden:', error);
    
    if (error.message === 'Orden no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Marcar como en preparación
 * POST /api/orders/:id/preparing
 */
exports.markAsPreparing = async (req, res) => {
  try {
    const order = await orderService.markAsPreparing(req.params.id);
    
    res.json({
      success: true,
      message: 'Orden en preparación',
      data: order
    });
  } catch (error) {
    console.error('Error al marcar como en preparación:', error);
    
    if (error.message === 'Orden no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Marcar como lista
 * POST /api/orders/:id/ready
 */
exports.markAsReady = async (req, res) => {
  try {
    const order = await orderService.markAsReady(req.params.id);
    
    res.json({
      success: true,
      message: 'Orden lista para retirar',
      data: order
    });
  } catch (error) {
    console.error('Error al marcar como lista:', error);
    
    if (error.message === 'Orden no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Completar orden
 * POST /api/orders/:id/complete
 */
exports.completeOrder = async (req, res) => {
  try {
    const order = await orderService.complete(req.params.id);
    
    res.json({
      success: true,
      message: 'Orden completada',
      data: order
    });
  } catch (error) {
    console.error('Error al completar orden:', error);
    
    if (error.message === 'Orden no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Cancelar orden
 * POST /api/orders/:id/cancel
 */
exports.cancelOrder = async (req, res) => {
  try {
    const order = await orderService.cancel(req.params.id);
    
    res.json({
      success: true,
      message: 'Orden cancelada',
      data: order
    });
  } catch (error) {
    console.error('Error al cancelar orden:', error);
    
    if (error.message === 'Orden no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Actualizar orden completa
 * PUT /api/orders/:id
 */
exports.updateOrder = async (req, res) => {
  try {
    const updatedOrder = await orderService.update(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Orden actualizada exitosamente',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error al actualizar orden:', error);
    
    if (error.message === 'Orden no encontrada') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Eliminar orden
 * DELETE /api/orders/:id
 */
exports.deleteOrder = async (req, res) => {
  try {
    await orderService.delete(req.params.id);
    
    res.json({
      success: true,
      message: 'Orden eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar orden:', error);
    
    if (error.message.includes('Orden') || error.message.includes('canceladas')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
