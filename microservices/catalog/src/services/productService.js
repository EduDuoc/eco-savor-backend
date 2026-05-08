const productRepository = require('../repositories/productRepository');
const productFactory = require('../factories/productFactory');

/**
 * Service Layer: Lógica de negocio del catálogo
 */
class ProductService {

  async create(productData) {
    const productToCreate = productFactory.create(productData);
    const product = await productRepository.create(productToCreate);
    return {
      id: product._id,
      ...product.toObject()
    };
  }

  async getById(id) {
    const product = await productRepository.findById(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    return product;
  }

  async list(filters) {
    return await productRepository.findAll(filters);
  }

  async getByRestaurant(restaurantId, available = true) {
    return await productRepository.findAvailableByRestaurant(restaurantId);
  }

  async getByCategory(category, available = true) {
    return await productRepository.findByCategory(category, available);
  }

  async update(id, updateData) {
    const product = await productRepository.update(id, updateData);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    return product;
  }

  async delete(id) {
    const product = await productRepository.delete(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
  }

  async updateStock(id, quantity) {
    if (quantity < 0) {
      throw new Error('La cantidad no puede ser negativa');
    }
    const product = await productRepository.updateQuantity(id, quantity);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    if (quantity === 0) {
      await productRepository.markAsUnavailable(id);
    }
    return product;
  }

  async markAsUnavailable(id) {
    const product = await productRepository.markAsUnavailable(id);
    if (!product) {
      throw new Error('Producto no encontrado');
    }
    return product;
  }
}

module.exports = new ProductService();
