const mongoose = require('mongoose');
const connectDB = async () => {
    try {
        // Intentamos conectar a la base de datos usando la URI del .env
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`📦 MongoDB Conectado: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Error al conectar a MongoDB: ${error.message}`);
        // Si falla la base de datos, el microservicio no puede funcionar, así que matamos el proceso
        process.exit(1); 
    }
};
module.exports = connectDB;