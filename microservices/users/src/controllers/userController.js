const User = require('../models/userModel');
// Registrar un nuevo usuario
exports.register = async (req, res) => {
  try {
    const { email, password, name, role, restaurantName, address, phone } = req.body;
    
    // Validar que el role sea válido
    if (!['restaurant', 'buyer'].includes(role)) {
      return res.status(400).json({ error: 'El rol debe ser "restaurant" o "buyer"' });
    }
    
    // Crear el usuario
    const user = new User({
      email,
      password,
      name,
      role,
      restaurantName,
      address,
      phone
    });
    
    await user.save();
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurantName: user.restaurantName
      }
    });
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    res.status(500).json({ error: error.message });
  }
};
// Login de usuario
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscar usuario por email
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    
    // Verificar contraseña (en producción usar bcrypt)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }
    
    res.json({
      message: 'Login exitoso',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurantName: user.restaurantName,
        address: user.address,
        phone: user.phone
      }
    });
  } catch (error) {
    console.error('Error al hacer login:', error);
    res.status(500).json({ error: error.message });
  }
};
// Obtener todos los restaurantes (para que los compradores vean)
exports.getRestaurants = async (req, res) => {
  try {
    const restaurants = await User.find({ role: 'restaurant' })
      .select('-password'); // No retornar la contraseña
    
    res.json({
      count: restaurants.length,
      restaurants
    });
  } catch (error) {
    console.error('Error al obtener restaurantes:', error);
    res.status(500).json({ error: error.message });
  }
};
// Obtener un usuario por ID
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({ user });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: error.message });
  }
};
// Actualizar perfil de usuario
exports.updateUser = async (req, res) => {
  try {
    const { name, restaurantName, address, phone } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, restaurantName, address, phone },
      { new: true, runValidators: true }
    ).select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    
    res.json({
      message: 'Perfil actualizado exitosamente',
      user
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({ error: error.message });
  }
};