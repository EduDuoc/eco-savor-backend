const userService = require('../services/userService');

/**
 * Controller Layer: Maneja requests HTTP
 * NO tiene lógica de negocio, solo delega al Service
 */

/**
 * Verifica que el usuario autenticado sea el dueño del recurso solicitado
 * (o tenga rol admin). Previene IDOR en GET/PUT/DELETE /api/users/:id
 * @param {Object} req
 * @returns {Boolean}
 */
const isOwnerOrAdmin = (req) => {
  return !!req.user && (req.user.role === 'admin' || req.user.sub === req.params.id);
};

/**
 * Registrar usuario
 * POST /api/users/register
 */
exports.register = async (req, res) => {
  try {
    const userData = req.body;
    
    // El service se encarga de toda la lógica
    const newUser = await userService.register(userData);
    
    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: newUser
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    
    // Manejo de errores según el tipo
    if (error.message === 'El email ya está registrado') {
      return res.status(409).json({ success: false, error: error.message });
    }
    if (error.message.includes('rol')) {
      return res.status(400).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Login de usuario
 * POST /api/users/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Validaciones básicas
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Email y contraseña son requeridos' 
      });
    }

    const user = await userService.login(email, password);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      data: user
    });
  } catch (error) {
    console.error('Error al hacer login:', error);
    
    if (error.message === 'Email o contraseña incorrectos') {
      return res.status(401).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Obtener todos los restaurantes
 * GET /api/users/restaurants
 */
exports.getRestaurants = async (req, res) => {
  try {
    const restaurants = await userService.getAllRestaurants();
    
    res.json({
      success: true,
      count: restaurants.length,
      data: restaurants
    });
  } catch (error) {
    console.error('Error al obtener restaurantes:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Obtener todos los usuarios - Solo admin
 * GET /api/users
 */
exports.getAllUsers = async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Solo administradores pueden acceder a este recurso'
      });
    }

    const users = await userService.getAllUsers();

    res.json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    console.error('Error al obtener usuarios:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Obtener usuario por ID
 * GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    if (!isOwnerOrAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para acceder a este recurso'
      });
    }

    const user = await userService.getUserById(req.params.id);
    
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    
    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Actualizar perfil de usuario
 * PUT /api/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    if (!isOwnerOrAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para modificar este recurso'
      });
    }

    const updatedUser = await userService.updateProfile(req.params.id, req.body);
    
    res.json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: updatedUser
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    
    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};

/**
 * Eliminar usuario
 * DELETE /api/users/:id
 */
exports.deleteUser = async (req, res) => {
  try {
    if (!isOwnerOrAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: 'No tiene permisos para eliminar este recurso'
      });
    }

    await userService.deleteUser(req.params.id);
    
    res.json({
      success: true,
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    
    if (error.message === 'Usuario no encontrado') {
      return res.status(404).json({ success: false, error: error.message });
    }
    
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
