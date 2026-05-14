const axios = require('axios');

/**
 * Crea un handler de proxy reutilizable para rutas de Express
 * 
 * @param {string} serviceUrl - URL base del servicio (ej: http://localhost:3002)
 * @param {string} targetPath - Path destino en el microservicio (ej: /products)
 * @param {Object} options - Configuración opcional
 * @param {boolean} options.forwardAuth - Si true, forwardea headers de autenticación (default: true)
 * @param {boolean} options.forwardQuery - Si true, forwardea query params en GET (default: true)
 * @param {number} options.timeout - Timeout en ms (default: 30000)
 * @param {string} options.methodOverride - Override del método HTTP (opcional)
 * @returns {Function} Handler de Express
 */
function createProxyHandler(serviceUrl, targetPath, options = {}) {
  const {
    forwardAuth = true,
    forwardQuery = true,
    timeout = 30000,
    methodOverride = null
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
      // Reemplaza :param en targetPath con valores de req.params
      let resolvedPath = targetPath;
      for (const [param, value] of Object.entries(req.params)) {
        resolvedPath = resolvedPath.replace(`:${param}`, value);
      }
      
      const url = `${serviceUrl}${resolvedPath}`;

      // Determinar método HTTP
      const method = methodOverride || req.method.toLowerCase();

      // Configurar request según método HTTP
      let axiosConfig;
      if (method === 'get') {
        // GET: forwardear query params si está habilitado
        axiosConfig = {
          headers,
          timeout,
          ...(forwardQuery && { params: req.query })
        };
        const response = await axios.get(url, axiosConfig);
        res.json(response.data);
      } else if (method === 'post') {
        // POST: enviar body
        axiosConfig = { headers, timeout };
        const response = await axios.post(url, req.body, axiosConfig);
        res.status(response.status).json(response.data);
      } else if (method === 'put') {
        // PUT: enviar body
        axiosConfig = { headers, timeout };
        const response = await axios.put(url, req.body, axiosConfig);
        res.status(response.status).json(response.data);
      } else if (method === 'delete') {
        // DELETE: puede llevar body en algunos casos
        axiosConfig = { headers, timeout, data: req.body };
        const response = await axios.delete(url, axiosConfig);
        res.status(response.status).json(response.data);
      } else {
        // Método no soportado
        return res.status(405).json({ 
          success: false, 
          error: `Método ${method} no soportado` 
        });
      }
    } catch (error) {
      // Manejo de errores simplificado - el errorHandler helper se usa en el caller
      console.error(`Proxy error (${method} ${targetPath}):`, error.message);
      const status = error.response?.status || 500;
      const message = error.response?.data?.error || 'Error en el servicio';
      res.status(status).json({ success: false, error: message });
    }
  };
}

module.exports = { createProxyHandler };
