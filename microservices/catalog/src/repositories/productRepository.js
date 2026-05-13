const Product = require('../models/productModel');

/**
 * Repository Pattern: Capa de acceso a datos de productos
 */
class ProductRepository {

  async create(productData) {
    const product = new Product(productData);
    return await product.save();
  }

  async findById(id) {
    return await Product.findById(id);
  }

  async findAll(filters = {}) {
    const query = {};
    
    if (filters.restaurantId) {
      query.restaurantId = filters.restaurantId;
    }
    if (filters.category) {
      query.category = filters.category;
    }
    if (filters.available !== undefined) {
      query.available = filters.available;
    }
    
    return await Product.find(query).sort({ createdAt: -1 });
  }

  async findAvailableByRestaurant(restaurantId) {
    return await Product.find({ 
      restaurantId, 
      available: true 
    }).sort({ createdAt: -1 });
  }

  async findByCategory(category, available = true) {
    return await Product.find({ 
      category, 
      available 
    }).sort({ createdAt: -1 });
  }

  async update(id, updateData) {
    return await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
  }

  async delete(id) {
    return await Product.findByIdAndDelete(id);
  }

  async updateQuantity(id, quantity) {
    return await Product.findByIdAndUpdate(
      id,
      { quantity },
      { new: true }
    );
  }

  async markAsUnavailable(id) {
    return await Product.findByIdAndUpdate(
      id,
      { available: false },
      { new: true }
    );
  }

  /**
   * Descuento atómico de stock
   * Usa findOneAndUpdate con condición $gte para evitar race conditions
   * @param {string} id - ID del producto
   * @param {number} quantity - Cantidad a descontar
   * @returns {Promise} Producto actualizado o null si no hay stock suficiente
   */
  async deductStock(id, quantity) {
    const result = await Product.findOneAndUpdate(
      { 
        _id: id, 
        quantity: { $gte: quantity }  // Solo si hay stock suficiente
      },
      { 
        $inc: { quantity: -quantity }  // Decrementar stock
      },
      { new: true }  // Retornar documento actualizado
    );

    // Si el stock llega a 0, marcar como no disponible
    if (result && result.quantity === 0) {
      await this.markAsUnavailable(id);
    }

    return result;
  }

  /**
   * Restaurar stock (para rollback o cancelación)
   * @param {string} id - ID del producto
   * @param {number} quantity - Cantidad a restaurar
   * @returns {Promise} Producto actualizado
   */
  async restoreStock(id, quantity) {
    const result = await Product.findByIdAndUpdate(
      id,
      { 
        $inc: { quantity: quantity },
        available: true  // Asegurar que esté disponible
      },
      { new: true }
    );
    return result;
  }
}

module.exports = new ProductRepository();
