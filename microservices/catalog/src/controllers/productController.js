const productService = require('../services/productService');

/**
 * Controller: Maneja requests HTTP de productos
 */

exports.createProduct = async (req, res) => {
  try {
    const productData = req.body;
    const newProduct = await productService.create(productData);
    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: newProduct
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    if (error.message.includes('Categoría') || error.message.includes('precio')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.getProductById = async (req, res) => {
  try {
    const product = await productService.getById(req.params.id);
    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    if (error.message === 'Producto no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.listProducts = async (req, res) => {
  try {
    const { restaurantId, category, available } = req.query;
    const filters = {};
    if (restaurantId) filters.restaurantId = restaurantId;
    if (category) filters.category = category;
    if (available !== undefined) filters.available = available === 'true';
    const products = await productService.list(filters);
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.getProductsByRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { available } = req.query;
    const products = await productService.getByRestaurant(restaurantId, available !== 'false');
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error al obtener productos del restaurante:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { available } = req.query;
    const products = await productService.getByCategory(category, available !== 'false');
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error al obtener productos por categoría:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const updatedProduct = await productService.update(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Producto actualizado exitosamente',
      data: updatedProduct
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    if (error.message === 'Producto no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.deleteProduct = async (req, res) => {
  try {
    await productService.delete(req.params.id);
    res.json({
      success: true,
      message: 'Producto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar producto:', error);
    if (error.message === 'Producto no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.updateStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ success: false, error: 'La cantidad es requerida' });
    }
    const product = await productService.updateStock(req.params.id, quantity);
    res.json({
      success: true,
      message: 'Stock actualizado exitosamente',
      data: product
    });
  } catch (error) {
    console.error('Error al actualizar stock:', error);
    if (error.message === 'Producto no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

exports.markAsUnavailable = async (req, res) => {
  try {
    const product = await productService.markAsUnavailable(req.params.id);
    res.json({
      success: true,
      message: 'Producto marcado como no disponible',
      data: product
    });
  } catch (error) {
    console.error('Error al marcar producto como no disponible:', error);
    if (error.message === 'Producto no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
