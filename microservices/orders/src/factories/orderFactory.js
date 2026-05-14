/**
 * Factory Method Pattern: Crea órdenes según el tipo.
 */

class OrderFactory {

  /**
   * Crear orden estándar (un solo restaurante)
   */
  createStandardOrder(data) {
    return {
      userId: data.userId,
      items: data.items.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        restaurantId: item.restaurantId,
        restaurantName: item.restaurantName
      })),
      totalAmount: this.calculateTotal(data.items),
      status: 'pending',
      restaurantId: data.restaurantId,
      restaurantName: data.restaurantName,
      pickupTime: new Date(data.pickupTime),
      customerName: data.customerName,
      customerPhone: data.customerPhone || null,
      notes: data.notes || null
    };
  }

  /**
   * Crear orden express (para retiro inmediato)
   */
  createExpressOrder(data) {
    const baseOrder = this.createStandardOrder(data);
    // Pickup time es en 30 minutos desde ahora
    baseOrder.pickupTime = new Date(Date.now() + 30 * 60 * 1000);
    baseOrder.notes = (data.notes || '') + ' [PEDIDO EXPRESS]';
    return baseOrder;
  }

  /**
   * Crear orden programada (para más tarde)
   */
  createScheduledOrder(data, scheduledTime) {
    const baseOrder = this.createStandardOrder(data);
    baseOrder.pickupTime = new Date(scheduledTime);
    baseOrder.notes = (data.notes || '') + ' [PEDIDO PROGRAMADO]';
    return baseOrder;
  }

  /**
   * Calcular total de la orden
   */
  calculateTotal(items) {
    return items.reduce((total, item) => {
      return total + (item.price * item.quantity);
    }, 0);
  }

  /**
   * Factory Method principal
   */
  create(data, orderType = 'standard', scheduledTime = null) {
    // Validar que haya items
    if (!data.items || data.items.length === 0) {
      throw new Error('La orden debe tener al menos un producto');
    }

    // Validar que todos los items sean del mismo restaurante
    const restaurantIds = [...new Set(data.items.map(item => item.restaurantId))];
    if (restaurantIds.length > 1) {
      throw new Error('Todos los productos deben ser del mismo restaurante');
    }

    // Validar pickup time
    if (!data.pickupTime && orderType !== 'express' && !scheduledTime) {
      throw new Error('Debe especificar la hora de retiro');
    }

    switch (orderType) {
      case 'express':
        return this.createExpressOrder(data);
      case 'scheduled':
        return this.createScheduledOrder(data, scheduledTime);
      case 'standard':
      default:
        return this.createStandardOrder(data);
    }
  }
}

module.exports = new OrderFactory();
