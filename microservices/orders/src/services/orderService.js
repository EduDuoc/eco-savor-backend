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

    // VALIDAR STOCK antes de crear la orden y obtener los datos REALES
    // (precio, nombre, restaurante) desde catalog-service. Nunca confiamos
    // en el precio/totalAmount que envía el cliente: se ignoran y se
    // reemplazan por los items validados contra el catálogo.
    orderData.items = await stockService.validateStock(orderData.items);

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
   * IMPORTANTE: la transición a 'confirmed' SIEMPRE pasa por confirm(),
   * que es la única vía que descuenta stock de forma atómica. Esto evita
   * que se pueda "saltar" a confirmed sin descontar stock.
   */
  async updateStatus(id, status) {
    const validStatuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      throw new Error(`Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`);
    }

    if (status === 'confirmed') {
      return await this.confirm(id);
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
   * Descuenta stock cuando se confirma.
   * La transición pending -> confirmed es atómica (findOneAndUpdate
   * condicionado) para evitar condiciones de carrera: ante confirmaciones
   * concurrentes, solo una puede ganar y solo esa descuenta stock.
   */
  async confirm(id) {
    const confirmedOrder = await orderRepository.confirmPending(id);

    if (!confirmedOrder) {
      // No se pudo confirmar: o no existe, o ya no está en pending
      const existing = await orderRepository.findById(id);
      if (!existing) {
        throw new Error('Orden no encontrada');
      }
      const error = new Error(`Solo se pueden confirmar órdenes en estado pending. Estado actual: ${existing.status}`);
      error.isConflict = true;
      throw error;
    }

    try {
      // DESCONTAR STOCK al confirmar
      await stockService.deductStock(confirmedOrder.items);
    } catch (error) {
      // Si falla el descuento de stock, revertimos el estado a pending
      // para no dejar una orden "confirmed" sin su stock descontado
      await orderRepository.updateStatus(id, 'pending');
      throw error;
    }

    // Marcar que el stock fue descontado exitosamente (usado por cancel()
    // para decidir si corresponde restaurar stock)
    const finalOrder = await orderRepository.markStockDeducted(id);

    // Notificar al cliente sobre el cambio de estado
    await notificationService.notifyStatusChange(finalOrder, 'confirmed');

    return finalOrder;
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
   * Restaura stock SOLO si realmente fue descontado (stockDeducted === true).
   * No se puede cancelar una orden ya completada o ya cancelada.
   */
  async cancel(id) {
    const order = await this.getById(id);

    if (order.status === 'completed' || order.status === 'cancelled') {
      const error = new Error(`No se puede cancelar una orden en estado ${order.status}`);
      error.isConflict = true;
      throw error;
    }

    // RESTAURAR STOCK solo si efectivamente se había descontado
    if (order.stockDeducted) {
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
