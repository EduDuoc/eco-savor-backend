const productService = require('../services/productService');

/**
 * Controller: Maneja requests HTTP de productos
 */

exports.createProduct = async (req, res) => {
  try {
    // IMPORTANTE: restaurantId y restaurantName DEBEN venir del JWT, no del body
    // Esto previene que un usuario cree productos para otro restaurant
    const productData = {
      ...req.body,
      restaurantId: req.user?.sub,           // ID del usuario desde JWT
      restaurantName: req.user?.restaurantName || req.user?.name  // Nombre del restaurante desde JWT
    };
    
    const newProduct = await productService.create(productData);
    res.status(201).json({
      success: true,
      message: 'Producto creado exitosamente',
      data: newProduct
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    if (error.message.includes('Categoría') || error.message.includes('precio') || error.message.includes('restaurant')) {
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

/**
 * Endpoint para obtener productos del restaurante AUTENTICADO
 * Usa el ID del usuario del token JWT
 */
exports.getMyProducts = async (req, res) => {
  try {
    if (!req.user || !req.user.sub) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado'
      });
    }
    
    const restaurantId = req.user.sub;
    const { available } = req.query;
    const products = await productService.getByRestaurant(restaurantId, available !== 'false');
    res.json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    console.error('Error al obtener mis productos:', error);
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

/**
 * Endpoint INTERNO para descuento atómico de stock
 * Solo accesible desde el orders service con API key interna
 * PUT /products/:id/deductStock
 */
exports.deductStock = async (req, res) => {
  try {
    console.log('📦 deductStock - Request recibido:', {
      productId: req.params.id,
      quantity: req.body.quantity,
      hasApiKey: !!req.headers['x-internal-api-key']
    });
    
    // Verificar API key interna
    const apiKey = req.headers['x-internal-api-key'];
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'ecosaver_internal_key_change_in_prod';
    
    console.log('📦 deductStock - API Key check:', apiKey === INTERNAL_API_KEY ? '✅ OK' : '❌ FAIL');
    
    if (apiKey !== INTERNAL_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado. API key interna requerida.'
      });
    }

    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Cantidad inválida'
      });
    }

    console.log('📦 deductStock - Llamando a productService.deductStock...');
    const product = await productService.deductStock(req.params.id, quantity);
    
    if (!product) {
      return res.status(409).json({
        success: false,
        error: 'Stock insuficiente',
        details: {
          productId: req.params.id,
          requested: quantity
        }
      });
    }

    res.json({
      success: true,
      message: 'Stock descontado exitosamente',
      data: product
    });
  } catch (error) {
    console.error('Error al descontar stock:', error);
    if (error.message === 'Producto no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Endpoint INTERNO para restaurar stock
 * Solo accesible desde el orders service con API key interna
 * PUT /products/:id/restoreStock
 */
exports.restoreStock = async (req, res) => {
  try {
    // Verificar API key interna
    const apiKey = req.headers['x-internal-api-key'];
    const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'ecosaver_internal_key_change_in_prod';
    
    if (apiKey !== INTERNAL_API_KEY) {
      return res.status(401).json({
        success: false,
        error: 'No autorizado. API key interna requerida.'
      });
    }

    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Cantidad inválida'
      });
    }

    const product = await productService.restoreStock(req.params.id, quantity);
    
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Stock restaurado exitosamente',
      data: product
    });
  } catch (error) {
    console.error('Error al restaurar stock:', error);
    if (error.message === 'Producto no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
