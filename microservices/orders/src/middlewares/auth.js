const { expressjwt } = require('express-jwt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ecosaver_dev_secret_change_in_prod';

/**
 * Middleware de autenticación JWT para Orders Service
 * Verifica el token JWT y extrae la información del usuario
 * 
 * TODAS las rutas de órdenes requieren autenticación
 * 
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
const authMiddleware = (req, res, next) => {
  // Middleware de express-jwt que verifica el token
  const jwtMiddleware = expressjwt({
    secret: JWT_SECRET,
    algorithms: ['HS256']
  });

  jwtMiddleware(req, res, (err) => {
    if (err) {
      if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
          success: false,
          error: 'Token inválido o expirado. Por favor inicie sesión nuevamente.'
        });
      }
      return res.status(401).json({
        success: false,
        error: 'No autorizado. Token requerido.'
      });
    }

    // req.auth está disponible (payload del JWT)
    // Subordinamos la información del usuario para que esté disponible como req.user
    if (req.auth) {
      req.user = {
        sub: req.auth.sub,      // ID del usuario
        email: req.auth.email,
        role: req.auth.role,
        name: req.auth.name,     // Nombre del usuario (necesario para órdenes)
        restaurantName: req.auth.restaurantName  // Nombre del restaurante (para órdenes)
      };
    }

    next();
  });
};

/**
 * Middleware de autenticación opcional
 * Si hay token, lo valida y settea req.user
 * Si no hay token, continúa sin error
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      name: decoded.name,
      restaurantName: decoded.restaurantName
    };
  } catch (error) {
    // Token inválido pero no bloqueamos - es opcional
  }

  next();
};

module.exports = { authMiddleware, optionalAuth };
