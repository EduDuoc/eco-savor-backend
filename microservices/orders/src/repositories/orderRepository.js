const Order = require('../models/orderModel');

/**
 * Repository Pattern: Capa de acceso a datos de órdenes
 */
class OrderRepository {

  async create(orderData) {
    const order = new Order(orderData);
    return await order.save();
  }

  async findById(id) {
    return await Order.findById(id);
  }

  async findAll(filters = {}) {
    const query = {};
    
    if (filters.userId) {
      query.userId = filters.userId;
    }
    if (filters.restaurantId) {
      query.restaurantId = filters.restaurantId;
    }
    if (filters.status) {
      query.status = filters.status;
    }
    
    return await Order.find(query).sort({ createdAt: -1 });
  }

  async findByUser(userId) {
    return await Order.find({ userId }).sort({ createdAt: -1 });
  }

  async findByRestaurant(restaurantId, status = null) {
    const query = { restaurantId };
    if (status) {
      query.status = status;
    }
    return await Order.find(query).sort({ createdAt: -1 });
  }

  async findByStatus(status) {
    return await Order.find({ status }).sort({ createdAt: -1 });
  }

  async update(id, updateData) {
    return await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
  }

  async updateStatus(id, status) {
    return await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
  }

  /**
   * Transición atómica pending -> confirmed.
   * Usa findOneAndUpdate condicionado por status para evitar condiciones de
   * carrera: si dos requests intentan confirmar al mismo tiempo, solo una
   * puede ganar la actualización (la otra recibe null).
   * @param {string} id
   * @returns {Promise<Order|null>} La orden confirmada, o null si no existe
   *   o ya no estaba en 'pending'.
   */
  async confirmPending(id) {
    return await Order.findOneAndUpdate(
      { _id: id, status: 'pending' },
      { status: 'confirmed' },
      { new: true }
    );
  }

  /**
   * Marca la orden como que su stock ya fue descontado exitosamente.
   * @param {string} id
   */
  async markStockDeducted(id) {
    return await Order.findByIdAndUpdate(
      id,
      { stockDeducted: true },
      { new: true }
    );
  }

  async cancel(id, cancelledBy) {
    return await Order.findByIdAndUpdate(
      id,
      { status: 'cancelled', cancelledBy },
      { new: true }
    );
  }

  /**
   * Estadísticas agregadas de un restaurante: ventas por mes, horarios
   * de mayor venta, productos más vendidos, conteo por estado, y
   * detalle de hoy separando cancelaciones por comprador vs restaurante.
   */
  async getStatsByRestaurant(restaurantId) {
    const objectMatch = { restaurantId };

    const [salesByMonth, peakHours, topProducts, statusCounts, todayStats] = await Promise.all([
      Order.aggregate([
        { $match: { ...objectMatch, status: 'completed' } },
        { $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            total: { $sum: '$totalAmount' },
            count: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
      ]),
      Order.aggregate([
        { $match: objectMatch },
        { $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]),
      Order.aggregate([
        { $match: { ...objectMatch, status: 'completed' } },
        { $unwind: '$items' },
        { $group: {
            _id: '$items.name',
            totalQuantity: { $sum: '$items.quantity' },
            totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } }
        }},
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 }
      ]),
      Order.aggregate([
        { $match: objectMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Order.aggregate([
        { $match: {
            ...objectMatch,
            createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) }
        }},
        { $group: {
            _id: { status: '$status', cancelledBy: '$cancelledBy' },
            count: { $sum: 1 }
        }}
      ]),
    ]);

    return { salesByMonth, peakHours, topProducts, statusCounts, todayStats };
  }

  /**
   * Estadísticas de compra de un cliente: total gastado, cantidad de
   * pedidos, restaurantes favoritos, día de la semana y horario preferido.
   */
  async getStatsByCustomer(userId) {
    const match = { userId };

    const [totals, favoriteRestaurant, dayOfWeekPref, hourPref] = await Promise.all([
      Order.aggregate([
        { $match: { ...match, status: 'completed' } },
        { $group: {
            _id: null,
            totalSpent: { $sum: '$totalAmount' },
            orderCount: { $sum: 1 }
        }}
      ]),
      Order.aggregate([
        { $match: { ...match, status: 'completed' } },
        { $group: {
            _id: '$restaurantName',
            count: { $sum: 1 },
            totalSpent: { $sum: '$totalAmount' }
        }},
        { $sort: { count: -1 } }
      ]),
      Order.aggregate([
        { $match: match },
        { $group: {
            _id: { $dayOfWeek: '$createdAt' },
            count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]),
      Order.aggregate([
        { $match: match },
        { $group: {
            _id: { $hour: '$createdAt' },
            count: { $sum: 1 }
        }},
        { $sort: { count: -1 } }
      ]),
    ]);

    return {
      totalSpent: totals[0]?.totalSpent || 0,
      orderCount: totals[0]?.orderCount || 0,
      favoriteRestaurants: favoriteRestaurant,
      dayOfWeekPreference: dayOfWeekPref,
      hourPreference: hourPref,
    };
  }

  async delete(id) {
    return await Order.findByIdAndDelete(id);
  }
}

module.exports = new OrderRepository();
