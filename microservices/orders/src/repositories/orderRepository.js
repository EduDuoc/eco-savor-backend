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

  async cancel(id) {
    return await Order.findByIdAndUpdate(
      id,
      { status: 'cancelled' },
      { new: true }
    );
  }

  async delete(id) {
    return await Order.findByIdAndDelete(id);
  }
}

module.exports = new OrderRepository();
