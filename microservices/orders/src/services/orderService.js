const orderRepository = require('../repositories/orderRepository');
const orderFactory = require('../factories/orderFactory');
const notificationService = require('../strategies/notificationStrategy');
const stockService = require('./stockService');

/**
 * Service Layer: Lógica de negocio de órdenes
 */
class OrderService {

  /**
   * Crear nueva orden
   * Valida stock antes de crear
   */
  async create(orderData, orderType = 'standard', scheduledTime = null, userId) {
    // Validar que haya items en la orden
    if (!orderData.items || orderData.items.length === 0) {
      throw new Error('La orden debe tener al menos un producto');
    }

    // VALIDAR STOCK antes de crear la orden
    await stockService.validateStock(orderData.items);

    // Agregar userId del usuario autenticado
    orderData.userId = userId;

    // Verificar que todos los items sean del mismo restaurante
    const restaurantId = orderData.items[0].restaurantId;
    const allSameRestaurant = orderData.items.every(item => item.restaurantId === restaurantId);
    if (!allSameRestaurant) {
      throw new Error('Todos los productos deben ser del mismo restaurante');
    }

    // Agregar restaurantId y restaurantName de los items
    orderData.restaurantId = restaurantId;
    orderData.restaurantName = orderData.items[0].restaurantName;

    // Calcular totalAmount si no viene
    if (!orderData.totalAmount) {
      orderData.totalAmount = orderData.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    }

    // Usar Factory para crear la orden
    const orderToCreate = orderFactory.create(orderData, orderType, scheduledTime);
    
    // Crear orden usando Repository
    const order = await orderRepository.create(orderToCreate);
    
    // Notificar al restaurante sobre la nueva orden
    await notificationService.notifyNewOrder(order);
    
    return {
      id: order._id,
      ...order.toObject()
    };
  }

  /**
   * Obtener orden por ID
   */
  async getById(id) {
    const order = await orderRepository.findById(id);
    if (!order) {
      throw new Error('Orden no encontrada');
    }
    return order;
  }

  /**
   * Listar órdenes con filtros
   */
  async list(filters) {
    return await orderRepository.findAll(filters);
  }

  /**
   * Obtener órdenes de un usuario
   */
  async getByUser(userId) {
    return await orderRepository.findByUser(userId);
  }

  /**
   * Obtener órdenes de un restaurante
   */
  async getByRestaurant(restaurantId, status = null) {
    return await orderRepository.findByRestaurant(restaurantId, status);
  }

  /**
   * Actualizar estado de orden
   */
  async updateStatus(id, status) {
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`);
    }

    const order = await orderRepository.updateStatus(id, status);
    if (!order) {
      throw new Error('Orden no encontrada');
    }

    // Notificar al cliente sobre el cambio de estado
    await notificationService.notifyStatusChange(order, status);

    return order;
  }

  /**
   * Confirmar orden
   * Descuenta stock cuando se confirma
   */
  async confirm(id) {
    const order = await this.getById(id);
    
    // Solo se puede confirmar si está pending
    if (order.status !== 'pending') {
      throw new Error(`Solo se pueden confirmar órdenes en estado pending. Estado actual: ${order.status}`);
    }

    // DESCOUNTAR STOCK al confirmar
    await stockService.deductStock(order.items);

    // Actualizar estado a confirmed
    return await this.updateStatus(id, 'confirmed');
  }

  /**
   * Marcar orden como en preparación
   */
  async markAsPreparing(id) {
    return await this.updateStatus(id, 'preparing');
  }

  /**
   * Marcar orden como lista
   */
  async markAsReady(id) {
    return await this.updateStatus(id, 'ready');
  }

  /**
   * Completar orden
   */
  async complete(id) {
    return await this.updateStatus(id, 'completed');
  }

  /**
   * Cancelar orden
   * Restaura stock si la orden ya había sido confirmada
   */
  async cancel(id) {
    const order = await this.getById(id);
    
    // RESTAURAR STOCK si la orden ya estaba confirmada
    if (order.status === 'confirmed' || order.status === 'preparing' || order.status === 'ready') {
      await stockService.restoreStock(order.items);
    }

    const cancelledOrder = await orderRepository.cancel(id);
    if (!cancelledOrder) {
      throw new Error('Orden no encontrada');
    }

    // Notificar al cliente
    await notificationService.notifyStatusChange(cancelledOrder, 'cancelled');

    return cancelledOrder;
  }

  /**
   * Actualizar orden completa
   */
  async update(id, updateData) {
    // No permitir actualizar status directamente (usar updateStatus)
    const { status, ...allowedUpdates } = updateData;
    const order = await orderRepository.update(id, allowedUpdates);
    if (!order) {
      throw new Error('Orden no encontrada');
    }
    return order;
  }

  /**
   * Eliminar orden (solo si está cancelada)
   */
  async delete(id) {
    const order = await orderRepository.findById(id);
    if (!order) {
      throw new Error('Orden no encontrada');
    }
    if (order.status !== 'cancelled') {
      throw new Error('Solo se pueden eliminar órdenes canceladas');
    }
    await orderRepository.delete(id);
  }
}

module.exports = new OrderService();
