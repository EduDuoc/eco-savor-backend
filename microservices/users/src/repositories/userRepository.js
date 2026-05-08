const User = require('../models/userModel');

/**
 * Repository Pattern: Capa de acceso a datos
 * Centraliza todas las operaciones con la base de datos
 * El controller NO habla directo con el modelo, usa el repository
 */
class UserRepository {
  
  /**
   * Crear un nuevo usuario
   * @param {Object} userData - Datos del usuario
   * @returns {Promise<User>} Usuario creado
   */
  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }

  /**
   * Buscar usuario por email
   * @param {String} email 
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    return await User.findOne({ email });
  }

  /**
   * Buscar usuario por ID
   * @param {String} id 
   * @returns {Promise<User|null>}
   */
  async findById(id) {
    return await User.findById(id);
  }

  /**
   * Buscar usuario por ID sin password
   * @param {String} id 
   * @returns {Promise<User|null>}
   */
  async findByIdWithoutPassword(id) {
    return await User.findById(id).select('-password');
  }

  /**
   * Obtener todos los restaurantes
   * @returns {Promise<User[]>}
   */
  async findAllRestaurants() {
    return await User.find({ role: 'restaurant' }).select('-password');
  }

  /**
   * Actualizar usuario
   * @param {String} id 
   * @param {Object} updateData 
   * @returns {Promise<User|null>}
   */
  async update(id, updateData) {
    return await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
  }

  /**
   * Eliminar usuario
   * @param {String} id 
   * @returns {Promise<User|null>}
   */
  async delete(id) {
    return await User.findByIdAndDelete(id);
  }

  /**
   * Buscar por ID y rol
   * @param {String} id 
   * @param {String} role 
   * @returns {Promise<User|null>}
   */
  async findByIdAndRole(id, role) {
    return await User.findOne({ _id: id, role }).select('-password');
  }
}

// Singleton pattern: una sola instancia del repository
module.exports = new UserRepository();
