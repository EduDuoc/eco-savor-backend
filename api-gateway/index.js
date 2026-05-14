const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { expressjwt } = require('express-jwt');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { SERVICES } = require('./src/services.config');
const { createProxyHandler } = require('./src/proxyHandler');

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
// === RUTA DE REGISTRO (pública, sin auth) ===
app.post('/api/auth/register', async (req, res) => {
  try {
    // Reenviar al microservicio de users
    const response = await axios.post(`${SERVICES.users}/api/users/register`, req.body);
    res.json(response.data);
  } catch (error) {
    console.error('Error en registro:', error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error interno del servidor';
    res.status(status).json({ success: false, error: message });
  }
});

// === RUTA DE LOGIN (pública, sin auth) ===
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    }

    // Consultar al microservicio de users para validar credenciales
    const response = await axios.post(`${SERVICES.users}/api/users/login`, { email, password });
    
    // Generar token JWT con los datos del usuario
    const user = response.data.data;
    const token = jwt.sign(
      { 
        sub: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name,  // Nombre de la persona
        restaurantName: user.restaurantName || user.name  // Nombre del restaurante (fallback al nombre si no es restaurant)
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
    '/'
  ] 
}));

// === MANEJO DE ERRORES DE AUTH Y GLOBAL ===
// Un solo handler para todos los errores
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido o expirado. Por favor inicie sesión nuevamente.' 
    });
  }
  
  // Error global
  console.error('Error global:', err.message);
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del API Gateway' 
  });
});

// === CONFIGURACIÓN DEL PROXY ===
// Rutas específicas para catalog con axios (evita bugs de http-proxy-middleware con body)

// POST products - Crear producto
app.post('/api/catalog/products', createProxyHandler(SERVICES.catalog, '/products'));

// GET products (público)
app.get('/api/catalog/products', createProxyHandler(SERVICES.catalog, '/products', { forwardAuth: false }));

// GET product by ID
app.get('/api/catalog/products/:id', createProxyHandler(SERVICES.catalog, '/products/:id', { forwardAuth: false }));

// PUT product - Actualizar producto
app.put('/api/catalog/products/:id', createProxyHandler(SERVICES.catalog, '/products/:id'));

// DELETE product - Eliminar producto
app.delete('/api/catalog/products/:id', createProxyHandler(SERVICES.catalog, '/products/:id'));

// GET my-products - Productos del restaurante autenticado
app.get('/api/catalog/my-products', createProxyHandler(SERVICES.catalog, '/products/my-products'));

// Proxy para users-service
app.use('/api/users', createProxyMiddleware({ 
  target: SERVICES.users, 
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '',
  },
  onProxyReq: (proxyReq, req) => {
    if (req.auth) {
      proxyReq.setHeader('X-User-Id', req.auth.sub);
      proxyReq.setHeader('X-User-Role', req.auth.role);
    }
  }
}));

// === HANDLERS PARA ORDERS (usando createProxyHandler) ===
// POST /api/orders - Crear orden
app.post('/api/orders', createProxyHandler(SERVICES.orders, '/api/orders'));

// GET /api/orders - Listar órdenes
app.get('/api/orders', createProxyHandler(SERVICES.orders, '/api/orders'));

// GET /api/orders/:id - Obtener orden por ID
app.get('/api/orders/:id', createProxyHandler(SERVICES.orders, '/api/orders/:id'));

// PUT /api/orders/:id - Actualizar orden completa
app.put('/api/orders/:id', createProxyHandler(SERVICES.orders, '/api/orders/:id'));

// PUT /api/orders/:id/status - Actualizar estado
app.put('/api/orders/:id/status', createProxyHandler(SERVICES.orders, '/api/orders/:id/status'));

// POST /api/orders/:id/confirm - Confirmar orden
app.post('/api/orders/:id/confirm', createProxyHandler(SERVICES.orders, '/api/orders/:id/confirm'));

// POST /api/orders/:id/preparing - Marcar como en preparación
app.post('/api/orders/:id/preparing', createProxyHandler(SERVICES.orders, '/api/orders/:id/preparing'));

// POST /api/orders/:id/ready - Marcar como lista
app.post('/api/orders/:id/ready', createProxyHandler(SERVICES.orders, '/api/orders/:id/ready'));

// POST /api/orders/:id/complete - Completar orden
app.post('/api/orders/:id/complete', createProxyHandler(SERVICES.orders, '/api/orders/:id/complete'));

// POST /api/orders/:id/cancel - Cancelar orden
app.post('/api/orders/:id/cancel', createProxyHandler(SERVICES.orders, '/api/orders/:id/cancel'));

// Proxy para restaurants (alias público para listar restaurantes)
app.use('/api/restaurants', createProxyMiddleware({ 
  target: SERVICES.users, 
  changeOrigin: true,
  pathRewrite: {
    '^/api/restaurants': '/api/users/restaurants',
  }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    service: 'API Gateway',
    timestamp: new Date().toISOString()
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
      health: '/health'
    }
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 API Gateway corriendo en http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Users Service: ${SERVICES.users}`);
  console.log(`   Catalog Service: ${SERVICES.catalog}`);
  console.log(`   Orders Service: ${SERVICES.orders}`);
});
