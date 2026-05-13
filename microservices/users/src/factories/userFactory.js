/**
 * Factory Method Pattern: Crea diferentes tipos de usuarios
 * según el rol, encapsulando la lógica de creación
 */

class UserFactory {
  
  /**
   * Crear datos base para cualquier usuario
   * @param {Object} data 
   * @returns {Object}
   */
  createBaseUser(data) {
    return {
      email: data.email.trim().toLowerCase(),
      password: data.password, // En producción: bcrypt.hash(data.password, 10)
      name: data.name.trim(),
      role: data.role
    };
  }

  /**
   * Crear un usuario tipo comprador (buyer)
   * @param {Object} data 
   * @returns {Object}
   */
  createBuyer(data) {
    const baseUser = this.createBaseUser(data);
    return {
      ...baseUser,
      role: 'buyer',
      restaurantName: undefined,
      address: data.address || undefined,
      phone: data.phone || undefined
    };
  }

  /**
   * Crear un usuario tipo restaurante (restaurant)
   * @param {Object} data 
   * @returns {Object}
   */
  createRestaurant(data) {
    const baseUser = this.createBaseUser(data);
    // Nota: restaurantName es requerido para restaurantes. Si no existe, usamos name como fallback
    // por seguridad defensiva, pero el frontend debería validarlo.
    const restaurantName = data.restaurantName?.trim() || data.name.trim();
    return {
      ...baseUser,
      role: 'restaurant',
      restaurantName: restaurantName,
      address: data.address || undefined,
      phone: data.phone || undefined
    };
  }

  /**
   * Factory Method principal: crea el usuario según el rol
   * @param {Object} data 
   * @returns {Object} Usuario creado según el tipo
   * @throws {Error} Si el rol es inválido
   */
  create(data) {
    if (!data.role || !['restaurant', 'buyer'].includes(data.role)) {
      throw new Error('El rol debe ser "restaurant" o "buyer"');
    }

    switch (data.role) {
      case 'restaurant':
        return this.createRestaurant(data);
      case 'buyer':
        return this.createBuyer(data);
      default:
        throw new Error('Rol no válido');
    }
  }
}

// Singleton: una sola instancia del factory
module.exports = new UserFactory();
