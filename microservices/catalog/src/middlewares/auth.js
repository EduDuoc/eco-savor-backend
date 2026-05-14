const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ecosaver_dev_secret_change_in_prod';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'ecosaver_internal_key_change_in_prod';

// Whitelist de rutas públicas (sin autenticación)
// Usamos match exacto o prefijo con / para evitar falsos positivos
const PUBLIC_ROUTES = [
  { path: '/', exact: true },  // Health check
  { path: '/products', exact: true },  // GET /products (listar todos)
  { path: '/products/restaurants', exact: false },  // GET /products/restaurants/:id
  { path: '/products/categories', exact: false },  // GET /products/categories/:id
];

/**
 * Middleware de autenticación JWT para Catalog Service
 * Verifica el token JWT O la INTERNAL_API_KEY para requests entre servicios
 * 
 * @param {Object} req - Request de Express
 * @param {Object} res - Response de Express
 * @param {Function} next - Next middleware
 */
const authMiddleware = (req, res, next) => {
  // Si la ruta es pública, continuar sin autenticar
  const isPublicRoute = PUBLIC_ROUTES.some(({ path, exact }) => {
    if (exact) {
      // Match exacto (solo para /products sin sub-rutas)
      return req.path === path && req.method === 'GET';
    } else {
      // Prefijo para sub-rutas
      return req.path.startsWith(path + '/') && req.method === 'GET';
    }
  });
  
  if (isPublicRoute) {
    return next();
  }

  // Verificar INTERNAL_API_KEY para requests entre servicios
  const internalApiKey = req.headers['x-internal-api-key'];
  if (internalApiKey === INTERNAL_API_KEY) {
    // Request interno válido, continuar
    return next();
  }

  // Middleware de express-jwt que verifica el token
  const { expressjwt } = require('express-jwt');
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
        name: req.auth.name,     // Nombre del usuario (necesario para productos)
        restaurantName: req.auth.restaurantName  // Nombre del restaurante (para productos)
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
