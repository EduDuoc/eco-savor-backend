/**
 * Middleware: maneja rutas no encontradas (404)
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
};

/**
 * Middleware: maneja errores no capturados (500)
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
};

module.exports = { notFoundHandler, errorHandler };
