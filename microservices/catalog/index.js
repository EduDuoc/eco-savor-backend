require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');
const productRoutes = require('./src/routes/productRoutes');
const { authMiddleware } = require('./src/middlewares/auth');
const { notFoundHandler, errorHandler } = require('./src/middlewares/errorHandlers');

const app = express();
const PORT = process.env.PORT || 3002;

// Conectar a MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de autenticación (verifica JWT en todas las rutas excepto públicas GET)
app.use(authMiddleware);

// Rutas
app.use('/products', productRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    service: 'Catalog Microservice',
    status: 'UP',
    message: 'Catalog service is running',
    timestamp: new Date().toISOString()
  });
});

// 404
app.use(notFoundHandler);

// Error handler global
app.use(errorHandler);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`📦 Catalog Microservice running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
