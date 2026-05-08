require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/database');
const userRoutes = require('./src/routes/userRoutes');
const app = express();
const PORT = process.env.PORT || 3001;
// Conectar a MongoDB
connectDB();
// Middlewares
app.use(cors());
app.use(express.json());
// Rutas
app.use('/api/users', userRoutes);
// Health check
app.get('/', (req, res) => {
  res.json({ 
    service: 'Users Microservice',
    status: 'UP',
    message: 'Users service is running' 
  });
});
// Iniciar servidor
app.listen(PORT, () => {
  console.log(`👤 Users Microservice running on http://localhost:${PORT}`);
});