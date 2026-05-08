const orderRepository = require('../repositories/orderRepository');
const orderFactory = require('../factories/orderFactory');
const notificationService = require('../strategies/notificationStrategy');

/**
 * Service Layer: Lógica de negocio de órdenes
 */
class OrderService {

  /**
   * Crear nueva orden
   */
  async create(orderData, orderType = 'standard', scheduledTime = null) {
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
   */
  async confirm(id) {
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
   */
  async cancel(id) {
    const order = await orderRepository.cancel(id);
    if (!order) {
      throw new Error('Orden no encontrada');
    }

    // Notificar al cliente
    await notificationService.notifyStatusChange(order, 'cancelled');

    return order;
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
