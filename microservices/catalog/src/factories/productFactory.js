/**
 * Factory Method: Crea productos con datos válidos
 */

class ProductFactory {

  create(data) {
    // Validar campos requeridos
    if (!data.name || !data.description) {
      throw new Error('Nombre y descripción son requeridos');
    }

    if (!data.price || data.price <= 0) {
      throw new Error('El precio debe ser mayor a 0');
    }

    if (!data.discountPrice || data.discountPrice <= 0) {
      throw new Error('El precio con descuento debe ser mayor a 0');
    }

    if (data.discountPrice >= data.price) {
      throw new Error('El precio con descuento debe ser menor al precio original');
    }

    // Validar categoría
    const validCategories = ['panadería', 'comida caliente', 'bebidas', 'postres', 'otros'];
    const category = data.category || 'otros';
    
    if (!validCategories.includes(category)) {
      throw new Error('Categoría inválida. Debe ser: ' + validCategories.join(', '));
    }

    // Construir producto
    return {
      name: data.name.trim(),
      description: data.description.trim(),
      price: parseFloat(data.price),
      discountPrice: parseFloat(data.discountPrice),
      quantity: parseInt(data.quantity) || 0,
      restaurantId: data.restaurantId || 'restaurant-001',
      restaurantName: data.restaurantName || 'Mi Restaurante',
      category: category,
      images: data.images || [],
      available: data.available !== false,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null
    };
  }
}

module.exports = new ProductFactory();
