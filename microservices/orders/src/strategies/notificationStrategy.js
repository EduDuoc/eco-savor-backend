/**
 * Strategy Pattern: Diferentes estrategias de notificación
 */

// Estrategia 1: Notificación por Email (simulada)
class EmailNotificationStrategy {
  async send(order, message) {
    console.log(`📧 [EMAIL] Enviando a ${order.customerName}: ${message}`);
    console.log(`   Orden #${order._id} - Total: $${order.totalAmount}`);
    return { method: 'email', sent: true, timestamp: new Date() };
  }
}

// Estrategia 2: Notificación por SMS (simulada)
class SMSNotificationStrategy {
  async send(order, message) {
    console.log(`📱 [SMS] Enviando a ${order.customerPhone}: ${message}`);
    return { method: 'sms', sent: true, timestamp: new Date() };
  }
}

// Estrategia 3: Notificación Push (simulada)
class PushNotificationStrategy {
  async send(order, message) {
    console.log(`🔔 [PUSH] Notificando usuario ${order.userId}: ${message}`);
    return { method: 'push', sent: true, timestamp: new Date() };
  }
}

/**
 * Context: NotificationService usa la estrategia seleccionada
 */
class NotificationService {
  constructor() {
    this.strategies = {
      email: new EmailNotificationStrategy(),
      sms: new SMSNotificationStrategy(),
      push: new PushNotificationStrategy()
    };
  }

  /**
   * Notificar usando una o múltiples estrategias
   */
  async notify(order, message, methods = ['push']) {
    const results = [];
    
    for (const method of methods) {
      if (this.strategies[method]) {
        try {
          const result = await this.strategies[method].send(order, message);
          results.push(result);
        } catch (error) {
          console.error(`Error al notificar por ${method}:`, error);
        }
      }
    }
    
    return results;
  }

  /**
   * Notificar al cliente sobre cambio de estado
   */
  async notifyStatusChange(order, newStatus) {
    const messages = {
      'confirmed': 'Tu pedido ha sido confirmado por el restaurante',
      'preparing': 'El restaurante está preparando tu pedido',
      'ready': 'Tu pedido está listo para retirar',
      'completed': '¡Gracias por tu compra! Tu pedido fue completado',
      'cancelled': 'Tu pedido ha sido cancelado'
    };

    const message = messages[newStatus] || `Estado actualizado: ${newStatus}`;
    return await this.notify(order, message, ['push', 'email']);
  }

  /**
   * Notificar al restaurante sobre nueva orden
   */
  async notifyNewOrder(order) {
    const message = `🔔 Nueva orden #${order._id} - Total: $${order.totalAmount}`;
    return await this.notify(order, message, ['push']);
  }
}

module.exports = new NotificationService();
