const orderService = require('../services/orderService');

/**
 * Controller: Maneja requests HTTP de órdenes
 */

/**
 * Crear nueva orden
 * POST /api/orders
 * Requiere rol: buyer
 */
exports.createOrder = async (req, res) => {
  try {
    console.log('🛒 createOrder - Request recibido:', {
      userId: req.user.sub,
      itemsCount: req.body.items?.length || 0,
      totalAmount: req.body.totalAmount
    });
    
    // El userId viene del usuario autenticado
    const userId = req.user.sub;
    const { orderType, scheduledTime, ...orderData } = req.body;
    
    console.log('🛒 createOrder - Llamando a orderService.create...');
    const newOrder = await orderService.create(orderData, orderType, scheduledTime, userId);
    
    console.log('🛒 createOrder - Orden creada:', newOrder.id || newOrder._id);
    
    res.status(201).json({
      success: true,
      message: 'Orden creada exitosamente',
      data: newOrder
    });
  } catch (error) {
    console.error('❌ Error al crear orden:', error);
    
    if (error.message.includes('productos') || error.message.includes('restaurante') || error.message.includes('hora')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    if (error.message.includes('Stock')) {
      return res.status(409).json({ success: false, error: error.message });
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
 * - buyers: ven solo sus órdenes
 * - restaurants: ven solo órdenes de su restaurante
 */
exports.listOrders = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user.sub;
    
    const filters = {};
    
    // Filtrado automático según el rol
    if (userRole === 'buyer') {
      filters.userId = userId;
    } else if (userRole === 'restaurant') {
      filters.restaurantId = userId; // userId es el restaurantId para restaurants
    }
    
    // Filtros adicionales por query params
    const { status } = req.query;
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
 * Requiere rol: buyer
 * Validación: el usuario solo puede ver SUS propias órdenes
 */
exports.getOrdersByUser = async (req, res) => {
  try {
    const authenticatedUserId = req.user.sub;
    const requestedUserId = req.params.userId;
    
    // Validar que el usuario solo pueda ver sus propias órdenes
    if (authenticatedUserId !== requestedUserId) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado. Solo puede ver sus propias órdenes.'
      });
    }
    
    const orders = await orderService.getByUser(requestedUserId);
    
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
 * Requiere rol: restaurant
 * Validación: el restaurant solo puede ver las órdenes de SU restaurante
 */
exports.getOrdersByRestaurant = async (req, res) => {
  try {
    const authenticatedRestaurantId = req.user.sub;
    const requestedRestaurantId = req.params.restaurantId;
    
    // Validar que el restaurant solo pueda ver sus propias órdenes
    if (authenticatedRestaurantId !== requestedRestaurantId) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado. Solo puede ver las órdenes de su propio restaurante.'
      });
    }
    
    const { status } = req.query;
    
    const orders = await orderService.getByRestaurant(requestedRestaurantId, status || null);
    
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
 * - buyers: pueden cancelar sus propias órdenes
 * - restaurants: pueden cancelar órdenes de su restaurante
 */
exports.cancelOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const userRole = req.user.role;
    const userId = req.user.sub;
    
    // Primero obtengo la orden para validar permisos
    const order = await orderService.getById(orderId);
    
    // Validar permisos según el rol
    if (userRole === 'buyer' && order.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado. Solo puede cancelar sus propias órdenes.'
      });
    }
    
    if (userRole === 'restaurant' && order.restaurantId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado. Solo puede cancelar órdenes de su restaurante.'
      });
    }
    
    const cancelledOrder = await orderService.cancel(orderId);
    
    res.json({
      success: true,
      message: 'Orden cancelada',
      data: cancelledOrder
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
