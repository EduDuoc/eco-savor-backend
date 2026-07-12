const { expressjwt } = require('express-jwt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ecosaver_dev_secret_change_in_prod';

// Whitelist de rutas públicas (sin autenticación)
// NOTA: '/' se compara con match exacto (no con startsWith), porque
// req.path.startsWith('/') es true para CUALQUIER ruta y dejaría todo el
// servicio sin autenticación.
const PUBLIC_ROUTES = ['/api/users/register', '/api/users/login', '/api/users/restaurants', '/api/feedback'];

/**
 * Middleware de autenticación JWT para Users Service
 * Verifica el token JWT y extrae la información del usuario
 * 
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
const authMiddleware = (req, res, next) => {
  // Si la ruta es pública, continuar sin autenticar
  if (req.path === '/' || PUBLIC_ROUTES.some(route => req.path.startsWith(route))) {
    return next();
  }

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
        role: req.auth.role
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
      role: decoded.role
    };
  } catch (error) {
    // Token inválido pero no bloqueamos - es opcional
  }

  next();
};

module.exports = { authMiddleware, optionalAuth };
