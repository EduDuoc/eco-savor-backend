/**
 * Middleware de autorización por roles
 * Verifica que el usuario tenga uno de los roles permitidos
 * 
 * @param  {...string} roles - Roles permitidos ('restaurant', 'buyer')
 * @returns {Function} Middleware de Express
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    // Verificar que el usuario esté autenticado
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'No autenticado. Por favor inicie sesión.'
      });
    }

    // Verificar que el usuario tenga uno de los roles permitidos
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Rol no autorizado. Se requiere rol: ${roles.join(' o ')}`
      });
    }

    next();
  };
};

module.exports = requireRole;
