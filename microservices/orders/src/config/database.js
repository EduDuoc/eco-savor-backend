const mongoose = require('mongoose');

// NOTA: esta función es casi idéntica a la de los otros microservicios
// (users, catalog). Es duplicación intencional-por-ahora: cada microservicio
// es un deployable independiente y no comparte un módulo/paquete común.
// No se introduce un mecanismo de código compartido entre servicios solo
// para esto; si en el futuro surge una necesidad más amplia de código
// compartido, evaluar un workspace/paquete común en ese momento.
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`📦 MongoDB Conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error al conectar a MongoDB: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
