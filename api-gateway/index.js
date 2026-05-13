const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { expressjwt } = require('express-jwt');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;
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
        role: user.role 
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

// === MIDDLEWARE DE AUTENTICACIÓN JWT ===
// Protege todas las rutas menos /api/auth/* y /health
app.use('/api/', expressjwt({ 
  secret: JWT_SECRET, 
  algorithms: ['HS256'] 
}).unless({ 
  path: [
    '/api/auth/login', 
    '/api/auth/register',
    '/health',
    '/'
  ] 
}));

// === MANEJO DE ERRORES DE AUTH ===
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ 
      success: false, 
      error: 'Token inválido o expirado. Por favor inicie sesión nuevamente.' 
    });
  }
  next();
});

// === CONFIGURACIÓN DEL PROXY ===
// Proxy para users-service
app.use('/api/users', createProxyMiddleware({ 
  target: SERVICES.users, 
  changeOrigin: true,
  pathRewrite: {
    '^/api/users': '',
  }
}));

// Proxy para catalog-service
app.use('/api/catalog', createProxyMiddleware({ 
  target: SERVICES.catalog, 
  changeOrigin: true,
  pathRewrite: {
    '^/api/catalog': '',
  }
}));

// Proxy para orders-service
app.use('/api/orders', createProxyMiddleware({ 
  target: SERVICES.orders, 
  changeOrigin: true,
  pathRewrite: {
    '^/api/orders': '',
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

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error global:', err.message);
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del API Gateway' 
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
