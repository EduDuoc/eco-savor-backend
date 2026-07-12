require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');
const userRoutes = require('./src/routes/userRoutes');
const feedbackRoutes = require('./src/routes/feedbackRoutes');
const { authMiddleware } = require('./src/middlewares/auth');
const { notFoundHandler, errorHandler } = require('./src/middlewares/errorHandlers');

const app = express();
const PORT = process.env.PORT || 3001;

// Conectar a MongoDB
connectDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware de autenticación (verifica JWT en todas las rutas excepto públicas)
app.use(authMiddleware);

// Rutas
app.use('/api/users', userRoutes);
app.use('/api/feedback', feedbackRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ 
    service: 'Users Microservice',
    status: 'UP',
    message: 'Users service is running',
    timestamp: new Date().toISOString()
  });
});

// Ruta 404
app.use(notFoundHandler);

// Manejo de errores global
app.use(errorHandler);

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`👤 Users Microservice running on http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
});
