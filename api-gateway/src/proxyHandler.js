const axios = require('axios');

/**
 * Crea un handler de proxy reutilizable para rutas de Express.
 * Soporta Circuit Breaker vía opossum cuando se pasa la opción `breaker`.
 * 
 * @param {string} serviceUrl - URL base del servicio (ej: http://localhost:3002)
 * @param {string} targetPath - Path destino en el microservicio (ej: /products)
 * @param {Object} options - Configuración opcional
 * @param {boolean} options.forwardAuth - Si true, forwardea headers de autenticación (default: true)
 * @param {boolean} options.forwardQuery - Si true, forwardea query params en GET (default: true)
 * @param {number} options.timeout - Timeout en ms (default: 30000)
 * @param {string} options.methodOverride - Override del método HTTP (opcional)
 * @param {CircuitBreaker} options.breaker - Instancia de opossum CircuitBreaker (opcional)
 * @returns {Function} Handler de Express
 */
function createProxyHandler(serviceUrl, targetPath, options = {}) {
  const {
    forwardAuth = true,
    forwardQuery = true,
    timeout = 30000,
    methodOverride = null,
    breaker = null
  } = options;

  return async (req, res) => {
    try {
      // Construir headers base
      const headers = { 'Content-Type': 'application/json' };
      
      // Forwardear autenticación si está habilitado
      if (forwardAuth) {
        if (req.auth) {
          headers['X-User-Id'] = req.auth.sub;
          headers['X-User-Role'] = req.auth.role;
        }
        if (req.headers.authorization) {
          headers['Authorization'] = req.headers.authorization;
        }
      }

      // Construir URL completa resolviendo route params dinámicamente
      let resolvedPath = targetPath;
      for (const [param, value] of Object.entries(req.params)) {
        resolvedPath = resolvedPath.replace(`:${param}`, value);
      }
      
      const url = `${serviceUrl}${resolvedPath}`;

      // Determinar método HTTP
      const method = methodOverride || req.method.toLowerCase();

      // Construir configuración del request
      const requestConfig = {
        method,
        url,
        headers,
        timeout,
        ...(dataForMethod(method, req.body)),
        ...(method === 'get' && forwardQuery && { params: req.query })
      };

      // Si hay circuit breaker, usarlo; si no, axios directo (backward compat)
      let response;
      if (breaker) {
        response = await breaker.fire(requestConfig);
      } else {
        response = await executeRequest(method, url, headers, timeout, forwardQuery, req);
      }

      // Manejar respuesta del breaker (puede ser respuesta real o fallback)
      if (response.status >= 400 || !response.status) {
        return res.status(response.status || 500).json(response.data);
      }

      res.status(response.status).json(response.data);
    } catch (error) {
      // Si el circuito está abierto, opossum tira error con este mensaje
      if (error.circuitOpen) {
        return res.status(503).json({
          success: false,
          error: 'Servicio no disponible temporalmente. Intente nuevamente en unos segundos.',
          circuitOpen: true,
        });
      }

      console.error(`Proxy error (${req.method} ${targetPath}):`, error.message);
      const status = error.response?.status || 500;
      const message = error.response?.data?.error || 'Error en el servicio';
      res.status(status).json({ success: false, error: message });
    }
  };
}

/**
 * Ejecuta un request HTTP directamente con axios (sin circuit breaker).
 * Usado como fallback cuando no se provee breaker.
 */
async function executeRequest(method, url, headers, timeout, forwardQuery, req) {
  const axiosConfig = { headers, timeout };
  if (forwardQuery && method === 'get') {
    axiosConfig.params = req.query;
  }

  switch (method) {
    case 'get':
      return axios.get(url, axiosConfig);
    case 'post':
      return axios.post(url, req.body, axiosConfig);
    case 'put':
      return axios.put(url, req.body, axiosConfig);
    case 'delete':
      return axios.delete(url, { ...axiosConfig, data: req.body });
    default:
      throw new Error(`Método ${method} no soportado`);
  }
}

/**
 * Determina qué datos enviar según el método HTTP.
 * GET no lleva body; POST/PUT llevan data; DELETE puede llevar body en data.
 */
function dataForMethod(method, body) {
  switch (method.toLowerCase()) {
    case 'get':
      return {};
    case 'post':
    case 'put':
      return { data: body };
    case 'delete':
      return { data: body || undefined };
    default:
      return {};
  }
}

module.exports = { createProxyHandler };
