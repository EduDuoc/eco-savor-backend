/**
 * Factory Method Pattern: Crea productos según la categoría
 */

class ProductFactory {

  createBaseProduct(data) {
    return {
      name: data.name.trim(),
      description: data.description.trim(),
      price: parseFloat(data.price),
      discountPrice: parseFloat(data.discountPrice),
      quantity: parseInt(data.quantity) || 0,
      restaurantId: data.restaurantId,
      restaurantName: data.restaurantName,
      category: data.category,
      images: data.images || [],
      available: data.available !== false,
      expiresAt: data.expiresAt || null
    };
  }

  createBakeryProduct(data) {
    const baseProduct = this.createBaseProduct(data);
    return {
      ...baseProduct,
      category: 'panadería',
      expiresAt: data.expiresAt || this.getDefaultExpiry(1)
    };
  }

  createHotFoodProduct(data) {
    const baseProduct = this.createBaseProduct(data);
    return {
      ...baseProduct,
      category: 'comida caliente',
      expiresAt: data.expiresAt || this.getDefaultExpiry(1)
    };
  }

  createBeverageProduct(data) {
    const baseProduct = this.createBaseProduct(data);
    return {
      ...baseProduct,
      category: 'bebidas',
      expiresAt: data.expiresAt || this.getDefaultExpiry(7)
    };
  }

  createDessertProduct(data) {
    const baseProduct = this.createBaseProduct(data);
    return {
      ...baseProduct,
      category: 'postres',
      expiresAt: data.expiresAt || this.getDefaultExpiry(2)
    };
  }

  getDefaultExpiry(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  create(data) {
    if (!data.category || !['panadería', 'comida caliente', 'bebidas', 'postres', 'otros'].includes(data.category)) {
      throw new Error('Categoría inválida');
    }

    switch (data.category) {
      case 'panadería':
        return this.createBakeryProduct(data);
      case 'comida caliente':
        return this.createHotFoodProduct(data);
      case 'bebidas':
        return this.createBeverageProduct(data);
      case 'postres':
        return this.createDessertProduct(data);
      case 'otros':
      default:
        return this.createBaseProduct(data);
    }
  }
}

module.exports = new ProductFactory();
