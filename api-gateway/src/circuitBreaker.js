const CircuitBreaker = require('opossum');
const axios = require('axios');

/**
 * Módulo de Circuit Breaker para proteger las llamadas a microservicios.
 * 
 * Implementa el patrón Circuit Breaker usando la librería opossum.
 * Cada microservicio tiene su propio breaker independiente con:
 * - Timeout de 15 segundos por request
 * - Apertura cuando el 50% de requests fallan en la ventana
 * - Reset automático después de 30 segundos (half-open)
 * - Fallback que devuelve error 503 amigable
 */

// ---------------------------------------------------------------------------
// Configuración base compartida por todos los breakers
// ---------------------------------------------------------------------------
const BASE_OPTIONS = {
  timeout: 15000,              // 15s máximo por request
  errorThresholdPercentage: 50, // Abre cuando 50% de requests fallan
  resetTimeout: 30000,          // Espera 30s antes de half-open
  rollingCountTimeout: 10000,   // Ventana de 10s para conteo de fallos
  rollingCountBuckets: 10,      // 10 buckets para el rolling window
  volumeThreshold: 5,           // Mínimo 5 requests antes de evaluar fallos
};

// ---------------------------------------------------------------------------
// Función helper: ejecuta un request HTTP genérico con axios
// ---------------------------------------------------------------------------
/**
 * @param {Object} config
 * @param {string} config.method - GET, POST, PUT, DELETE
 * @param {string} config.url - URL completa del endpoint
 * @param {Object} [config.headers] - Headers HTTP
 * @param {Object} [config.data] - Body (para POST/PUT)
 * @param {Object} [config.params] - Query params (para GET)
 * @param {number} [config.timeout] - Timeout por request en ms
 * @returns {Promise<Object>} respuesta de axios { status, data, headers }
 */
async function fireRequest(config) {
  const { method, url, headers = {}, data, params, timeout = 15000 } = config;

  const axiosConfig = { headers, timeout };
  if (params) axiosConfig.params = params;

  let response;
  switch (method.toLowerCase()) {
    case 'get':
      response = await axios.get(url, axiosConfig);
      break;
    case 'post':
      response = await axios.post(url, data, axiosConfig);
      break;
    case 'put':
      response = await axios.put(url, data, axiosConfig);
      break;
    case 'delete':
      response = await axios.delete(url, { ...axiosConfig, data });
      break;
    default:
      throw new Error(`Método HTTP no soportado: ${method}`);
  }

  // Errores 5xx (fallos del servidor) deben contar como fallos del circuito
  // Errores 4xx son del cliente y NO disparan el breaker
  if (response.status >= 500) {
    const err = new Error(`Service responded with ${response.status}`);
    err.response = response;
    throw err;
  }

  return response;
}

// ---------------------------------------------------------------------------
// Factory: crea un breaker para un microservicio específico
// ---------------------------------------------------------------------------
/**
 * @param {string} serviceName - Nombre legible del servicio (ej: "Users")
 * @returns {CircuitBreaker}
 */
function createServiceBreaker(serviceName) {
  const breaker = new CircuitBreaker(fireRequest, {
    ...BASE_OPTIONS,
  });

  // En opossum v8, el fallback se configura con el método .fallback(), NO en el constructor
  breaker.fallback((error, _config) => {
    // Si el circuito está abierto, devolver 503 de inmediato
    if (error && (error.message?.includes('Breaker is open') || error.circuitOpen)) {
      return {
        status: 503,
        data: {
          success: false,
          error: `Servicio ${serviceName} no disponible temporalmente. Intente nuevamente en unos segundos.`,
          circuitOpen: true,
        },
      };
    }
    // Error transitorio (timeout, conexión rechazada, etc.)
    return {
      status: 503,
      data: {
        success: false,
        error: `Error al conectar con el servicio ${serviceName}. Intente nuevamente.`,
        circuitOpen: false,
      },
    };
  });

  // -----------------------------------------------------------------------
  // Event listeners para monitoreo y debugging
  // -----------------------------------------------------------------------
  breaker.on('open', () => {
    console.warn(`🔴 CIRCUIT BREAKER ABIERTO para ${serviceName}: requests rechazados inmediatamente`);
  });

  breaker.on('halfOpen', () => {
    console.log(`🟡 Circuit breaker HALF-OPEN para ${serviceName}: probando recuperación...`);
  });

  breaker.on('close', () => {
    console.log(`🟢 Circuit breaker CERRADO para ${serviceName}: servicio restaurado`);
  });

  breaker.on('failure', (error) => {
    console.error(`❌ Fallo en ${serviceName}:`, error.message);
  });

  breaker.on('fallback', (result) => {
    // Solo loguear si no fue por circuito abierto (eso ya se loguea en 'open')
    if (!result?.data?.circuitOpen) {
      console.warn(`⚠️  Fallback activado para ${serviceName}`);
    }
  });

  return breaker;
}

// ---------------------------------------------------------------------------
// Instancias de breakers (una por microservicio)
// ---------------------------------------------------------------------------
const usersBreaker = createServiceBreaker('Users');
const catalogBreaker = createServiceBreaker('Catalog');
const ordersBreaker = createServiceBreaker('Orders');

// ---------------------------------------------------------------------------
// Helper: obtener estadísticas de todos los breakers
// ---------------------------------------------------------------------------
/**
 * Devuelve métricas actuales de los tres circuit breakers.
 * Útil para exponer en endpoint de health check.
 * @returns {Object} stats por servicio
 */
function getBreakerStats() {
  return {
    users: extractStats(usersBreaker, 'Users'),
    catalog: extractStats(catalogBreaker, 'Catalog'),
    orders: extractStats(ordersBreaker, 'Orders'),
  };
}

function extractStats(breaker, name) {
  return {
    name,
    state: breaker.opened ? 'OPEN' : (breaker.halfOpen ? 'HALF_OPEN' : 'CLOSED'),
    failures: breaker.stats.failures,
    successes: breaker.stats.successes,
    fallbacks: breaker.stats.fallbacks,
    timeouts: breaker.stats.timeouts,
    rejected: breaker.stats.rejects,
    fired: breaker.stats.fires,
  };
}

module.exports = {
  usersBreaker,
  catalogBreaker,
  ordersBreaker,
  getBreakerStats,
};
