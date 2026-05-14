/**
 * Helper para manejar errores de proxy
 * NO es middleware de Express - se llama desde catch blocks
 * 
 * @param {Error} error - Error capturado
 * @param {Object} res - Response de Express
 * @param {string} serviceName - Nombre del servicio para logging
 */
function handleProxyError(error, res, serviceName = 'servicio') {
  console.error(`Proxy error (${serviceName}):`, error.message);
  const status = error.response?.status || 500;
  const message = error.response?.data?.error || `Error en ${serviceName}`;
  res.status(status).json({ success: false, error: message });
}

module.exports = { handleProxyError };
