const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { expressjwt } = require('express-jwt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
// ⚠️ JWT_SECRET debe estar en .env. El fallback es SOLO para desarrollo local.
// En producción usar: process.env.JWT_SECRET sin fallback
const JWT_SECRET = process.env.JWT_SECRET || 'ecosaver_dev_secret_change_in_prod';

// URLs de los microservicios (Docker o local)
const SERVICES = {
  users: process.env.USERS_SERVICE_URL || 'http://localhost:3001',
  catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:3002',
  orders: process.env.ORDERS_SERVICE_URL || 'http://localhost:3003'
};

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
        name: user.name  // Necesario para crear productos
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
        role: user.role
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
app.post('/api/catalog/products', async (req, res) => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.auth) {
      headers['X-User-Id'] = req.auth.sub;
      headers['X-User-Role'] = req.auth.role;
    }
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    const response = await axios.post(`${SERVICES.catalog}/products`, req.body, { headers });
    res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Proxy error (POST /products):', error.message);
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error en catalog service';
    res.status(status).json({ success: false, error: message });
  }
});

// GET products (público)
app.get('/api/catalog/products', async (req, res) => {
  try {
    const response = await axios.get(`${SERVICES.catalog}/products`, { params: req.query });
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error en catalog service';
    res.status(status).json({ success: false, error: message });
  }
});

// GET product by ID
app.get('/api/catalog/products/:id', async (req, res) => {
  try {
    const response = await axios.get(`${SERVICES.catalog}/products/${req.params.id}`);
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error en catalog service';
    res.status(status).json({ success: false, error: message });
  }
});

// PUT product
app.put('/api/catalog/products/:id', async (req, res) => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.auth) {
      headers['X-User-Id'] = req.auth.sub;
      headers['X-User-Role'] = req.auth.role;
    }
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    const response = await axios.put(`${SERVICES.catalog}/products/${req.params.id}`, req.body, { headers });
    res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error en catalog service';
    res.status(status).json({ success: false, error: message });
  }
});

// DELETE product
app.delete('/api/catalog/products/:id', async (req, res) => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.auth) {
      headers['X-User-Id'] = req.auth.sub;
      headers['X-User-Role'] = req.auth.role;
    }
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    const response = await axios.delete(`${SERVICES.catalog}/products/${req.params.id}`, { headers });
    res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error en catalog service';
    res.status(status).json({ success: false, error: message });
  }
});

// GET my-products (solo para restaurantes autenticados)
app.get('/api/catalog/my-products', async (req, res) => {
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }
    
    // El catalog service tiene las rutas montadas en /products, entonces /my-products -> /products/my-products
    const response = await axios.get(`${SERVICES.catalog}/products/my-products`, { headers });
    res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const message = error.response?.data?.error || 'Error en catalog service';
    res.status(status).json({ success: false, error: message });
  }
});

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

// Proxy para orders-service
app.use('/api/orders', createProxyMiddleware({ 
  target: SERVICES.orders, 
  changeOrigin: true,
  pathRewrite: {
    '^/api/orders': '',
  },
  onProxyReq: (proxyReq, req) => {
    // Inyectar headers de usuario si está autenticado
    if (req.auth) {
      proxyReq.setHeader('X-User-Id', req.auth.sub);
      proxyReq.setHeader('X-User-Role', req.auth.role);
    }
  }
}));

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
