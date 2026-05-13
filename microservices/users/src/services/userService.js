const userRepository = require('../repositories/userRepository');
const userFactory = require('../factories/userFactory');

/**
 * Service Layer: Contiene la lógica de negocio
 * Usa el Repository para acceder a datos
 * Usa el Factory para crear objetos
 */
class UserService {

  /**
   * Registrar un nuevo usuario
   * @param {Object} userData 
   * @returns {Promise<Object>}
   */
  async register(userData) {
    // Usar Factory Method para crear el usuario según su rol
    const userToCreate = userFactory.create(userData);
    
    // Verificar si el email ya existe
    const existingUser = await userRepository.findByEmail(userToCreate.email);
    if (existingUser) {
      throw new Error('El email ya está registrado');
    }

    // Crear usuario usando Repository
    const user = await userRepository.create(userToCreate);

    // Retornar datos sin password
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      restaurantName: user.restaurantName,
      address: user.address,
      phone: user.phone,
      createdAt: user.createdAt
    };
  }

  /**
   * Login de usuario
   * @param {String} email 
   * @param {String} password 
   * @returns {Promise<Object>}
   */
  async login(email, password) {
    // Buscar usuario por email usando Repository
    const user = await userRepository.findByEmail(email);

    if (!user) {
      throw new Error('Email o contraseña incorrectos');
    }

    // Verificar contraseña con bcrypt
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new Error('Email o contraseña incorrectos');
    }

    // Retornar datos sin password
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      restaurantName: user.restaurantName,
      address: user.address,
      phone: user.phone
    };
  }

  /**
   * Obtener todos los restaurantes
   * @returns {Promise<Array>}
   */
  async getAllRestaurants() {
    return await userRepository.findAllRestaurants();
  }

  /**
   * Obtener usuario por ID
   * @param {String} id 
   * @returns {Promise<Object>}
   */
  async getUserById(id) {
    const user = await userRepository.findByIdWithoutPassword(id);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return user;
  }

  /**
   * Actualizar perfil de usuario
   * @param {String} id 
   * @param {Object} updateData 
   * @returns {Promise<Object>}
   */
  async updateProfile(id, updateData) {
    // No permitir actualizar email o password desde este endpoint
    const { email, password, role, ...allowedUpdates } = updateData;

    const user = await userRepository.update(id, allowedUpdates);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }

    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      restaurantName: user.restaurantName,
      address: user.address,
      phone: user.phone
    };
  }

  /**
   * Eliminar usuario
   * @param {String} id 
   * @returns {Promise<void>}
   */
  async deleteUser(id) {
    const user = await userRepository.delete(id);
    
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
  }
}

// Singleton: una sola instancia del servicio
module.exports = new UserService();
