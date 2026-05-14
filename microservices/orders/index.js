require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');
const orderRoutes = require('./src/routes/orderRoutes');
const { authMiddleware } = require('./src/middlewares/auth');

const app = express();
const PORT = process.env.PORT || 3003;

// Conectar a MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas PÚBLICAS (van PRIMERO, antes del middleware de auth)
// Health check - debe ser público para que funcione el Docker healthcheck
app.get('/', (req, res) => {
  res.json({ 
    service: 'Orders Microservice',
    status: 'UP',
    message: 'Orders service is running',
    timestamp: new Date().toISOString()
  });
});

// Middleware de autenticación (verifica JWT en todas las rutas EXCEPTO /)
app.use(authMiddleware);

// Rutas protegidas
app.use('/api/orders', orderRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error global:', err);
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🛒 Orders Microservice running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
