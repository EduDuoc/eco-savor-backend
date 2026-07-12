const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { expressjwt } = require('express-jwt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { SERVICES } = require('./src/services.config');
const { createProxyHandler } = require('./src/proxyHandler');
const { usersBreaker, catalogBreaker, ordersBreaker, getBreakerStats } = require('./src/circuitBreaker');

const app = express();
const PORT = process.env.PORT || 3000;
// ⚠️ JWT_SECRET debe estar en .env. El fallback es SOLO para desarrollo local.
// En producción usar: process.env.JWT_SECRET sin fallback
const JWT_SECRET = process.env.JWT_SECRET || 'ecosaver_dev_secret_change_in_prod';

// Middlewares globales
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// === RUTAS PÚBLICAS (van PRIMERO, antes del middleware JWT) ===
// === RUTA DE REGISTRO (pública, sin auth, protegida con Circuit Breaker) ===
app.post('/api/auth/register', async (req, res) => {
  try {
    // Usar circuit breaker para proteger la llamada al users-service
    const response = await usersBreaker.fire({
      method: 'post',
      url: `${SERVICES.users}/api/users/register`,
      data: req.body,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    // Si el breaker devolvió fallback (circuito abierto o error), response.data existe
    if (response.status === 503) {
      return res.status(503).json(response.data);
    }

    // Reenviar el status code real de users-service (ej. 409 email duplicado,
    // 400 datos inválidos), en vez de asumir 200 siempre
    res.status(response.status).json(response.data);
  } catch (error) {
    // Circuito abierto - opossum lanza error
    if (error.circuitOpen || error.message?.includes('Breaker is open')) {
      return res.status(503).json({
        success: false,
        error: 'Servicio de usuarios no disponible temporalmente. Intente nuevamente en unos segundos.',
        circuitOpen: true,
      });
    }
    console.error('Error en registro:', error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error interno del servidor';
    res.status(status).json({ success: false, error: message });
  }
});

// === RUTA DE LOGIN (pública, sin auth, protegida con Circuit Breaker) ===
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    }

    // Consultar al microservicio de users con circuit breaker
    const response = await usersBreaker.fire({
      method: 'post',
      url: `${SERVICES.users}/api/users/login`,
      data: { email, password },
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });

    // Si el breaker devolvió fallback (circuito abierto o error)
    if (response.status === 503) {
      return res.status(503).json(response.data);
    }

    // Cualquier respuesta no exitosa de users-service (401 credenciales
    // inválidas, 400 datos inválidos, etc.) se propaga tal cual al cliente.
    // NUNCA se firma un JWT si el login no fue exitoso.
    if (response.status < 200 || response.status >= 300) {
      return res.status(response.status).json(response.data);
    }

    // Generar token JWT con los datos del usuario
    const user = response.data.data;
    const token = jwt.sign(
      { 
        sub: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name,
        restaurantName: user.restaurantName || user.name
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ 
      success: true,
      message: 'Login exitoso',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        restaurantName: user.restaurantName
      }
    });
  } catch (error) {
    // Circuito abierto
    if (error.circuitOpen || error.message?.includes('Breaker is open')) {
      return res.status(503).json({
        success: false,
        error: 'Servicio de usuarios no disponible temporalmente. Intente nuevamente en unos segundos.',
        circuitOpen: true,
      });
    }
    console.error('Error en login:', error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error interno del servidor';
    res.status(status).json({ success: false, error: message });
  }
});

// === MIDDLEWARE DE AUTENTICACIÓN JWT ===
// Protege todas las rutas menos /api/auth/*, /api/restaurants, /api/catalog/products (GET público) y /health
app.use('/api/', expressjwt({ 
  secret: JWT_SECRET, 
  algorithms: ['HS256'] 
}).unless({ 
  path: [
    '/api/auth/login', 
    '/api/auth/register',
    '/api/restaurants',
    '/api/catalog/products',
    { url: '/api/catalog/products/([a-zA-Z0-9]+)', method: 'GET' },
    { url: '/api/catalog/categories/([a-zA-Z0-9]+)/products', method: 'GET' },
    { url: '/api/catalog/restaurants/([a-zA-Z0-9]+)/products', method: 'GET' },
    '/health',
    '/health/circuits',
    '/'
  ] 
}));

// === MANEJO DE ERRORES DE AUTH Y GLOBAL ===
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido o expirado. Por favor inicie sesión nuevamente.' 
    });
  }
  
  console.error('Error global:', err.message);
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del API Gateway' 
  });
});

// ===========================================================================
// RUTAS DE CATALOG — protegidas con Circuit Breaker (catalogBreaker)
// ===========================================================================

// POST products - Crear producto
app.post('/api/catalog/products', createProxyHandler(SERVICES.catalog, '/products', { breaker: catalogBreaker }));

// GET products (público)
app.get('/api/catalog/products', createProxyHandler(SERVICES.catalog, '/products', { forwardAuth: false, breaker: catalogBreaker }));

// GET product by ID
app.get('/api/catalog/products/:id', createProxyHandler(SERVICES.catalog, '/products/:id', { forwardAuth: false, breaker: catalogBreaker }));

// PUT product - Actualizar producto
app.put('/api/catalog/products/:id', createProxyHandler(SERVICES.catalog, '/products/:id', { breaker: catalogBreaker }));

// DELETE product - Eliminar producto
app.delete('/api/catalog/products/:id', createProxyHandler(SERVICES.catalog, '/products/:id', { breaker: catalogBreaker }));

// GET my-products - Productos del restaurante autenticado
app.get('/api/catalog/my-products', createProxyHandler(SERVICES.catalog, '/products/my-products', { breaker: catalogBreaker }));

// ===========================================================================
// PROXY PARA USERS — http-proxy-middleware (sin circuit breaker por ahora)
// Pendiente migrar a createProxyHandler para unificar protección
// ===========================================================================
app.use('/api/users', createProxyMiddleware({ 
  target: SERVICES.users, 
  changeOrigin: true,
  pathRewrite: (path, req) => '/api/users' + path,
  onProxyReq: (proxyReq, req) => {
    if (req.auth) {
      proxyReq.setHeader('X-User-Id', req.auth.sub);
      proxyReq.setHeader('X-User-Role', req.auth.role);
    }
  }
}));

// ===========================================================================
// RUTAS DE ORDERS — protegidas con Circuit Breaker (ordersBreaker)
// ===========================================================================

// POST /api/orders - Crear orden
app.post('/api/orders', createProxyHandler(SERVICES.orders, '/api/orders', { breaker: ordersBreaker }));

// GET /api/orders - Listar órdenes
app.get('/api/orders', createProxyHandler(SERVICES.orders, '/api/orders', { breaker: ordersBreaker }));

// GET /api/orders/restaurants/:restaurantId/stats - Estadísticas de un restaurante (solo admin)
app.get('/api/orders/restaurants/:restaurantId/stats', createProxyHandler(SERVICES.orders, '/api/orders/restaurants/:restaurantId/stats', { breaker: ordersBreaker }));

// GET /api/orders/customers/:userId/stats - Estadísticas de un cliente (solo admin)
app.get('/api/orders/customers/:userId/stats', createProxyHandler(SERVICES.orders, '/api/orders/customers/:userId/stats', { breaker: ordersBreaker }));

// GET /api/orders/:id - Obtener orden por ID
app.get('/api/orders/:id', createProxyHandler(SERVICES.orders, '/api/orders/:id', { breaker: ordersBreaker }));

// PUT /api/orders/:id - Actualizar orden completa
app.put('/api/orders/:id', createProxyHandler(SERVICES.orders, '/api/orders/:id', { breaker: ordersBreaker }));

// PUT /api/orders/:id/status - Actualizar estado
app.put('/api/orders/:id/status', createProxyHandler(SERVICES.orders, '/api/orders/:id/status', { breaker: ordersBreaker }));

// POST /api/orders/:id/confirm - Confirmar orden
app.post('/api/orders/:id/confirm', createProxyHandler(SERVICES.orders, '/api/orders/:id/confirm', { breaker: ordersBreaker }));

// POST /api/orders/:id/preparing - Marcar como en preparación
app.post('/api/orders/:id/preparing', createProxyHandler(SERVICES.orders, '/api/orders/:id/preparing', { breaker: ordersBreaker }));

// POST /api/orders/:id/ready - Marcar como lista
app.post('/api/orders/:id/ready', createProxyHandler(SERVICES.orders, '/api/orders/:id/ready', { breaker: ordersBreaker }));

// POST /api/orders/:id/complete - Completar orden
app.post('/api/orders/:id/complete', createProxyHandler(SERVICES.orders, '/api/orders/:id/complete', { breaker: ordersBreaker }));

// POST /api/orders/:id/cancel - Cancelar orden
app.post('/api/orders/:id/cancel', createProxyHandler(SERVICES.orders, '/api/orders/:id/cancel', { breaker: ordersBreaker }));

// ===========================================================================
// PROXY PARA RESTAURANTS — http-proxy-middleware (sin circuit breaker)
// Alias público para listar restaurantes
// ===========================================================================
app.use('/api/restaurants', createProxyMiddleware({ 
  target: SERVICES.users, 
  changeOrigin: true,
  pathRewrite: () => '/api/users/restaurants',
}));

// ===========================================================================
// HEALTH CHECKS
// ===========================================================================

// Health check básico
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'API Gateway',
    timestamp: new Date().toISOString(),
    circuits: getBreakerStats(),
  });
});

// Health check detallado de circuit breakers
app.get('/health/circuits', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'API Gateway - Circuit Breakers',
    timestamp: new Date().toISOString(),
    circuits: getBreakerStats(),
  });
});

// Ruta base
app.get('/', (req, res) => {
  res.json({ 
    message: 'Eco-Savor API Gateway is running',
    endpoints: {
      auth: '/api/auth/login',
      users: '/api/users',
      catalog: '/api/catalog',
      orders: '/api/orders',
      health: '/health',
      circuits: '/health/circuits',
    }
  });
});

// Iniciar servidor (solo si se ejecuta directamente, no al importarlo desde tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 API Gateway corriendo en http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Users Service: ${SERVICES.users}`);
    console.log(`   Catalog Service: ${SERVICES.catalog}`);
    console.log(`   Orders Service: ${SERVICES.orders}`);
    console.log(`   Circuit Breakers: ACTIVOS (users, catalog, orders)`);
  });
}

module.exports = app;
