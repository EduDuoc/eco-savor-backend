const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { createProxyMiddleware } = require('http-proxy-middleware');
const app = express();
const PORT = process.env.PORT || 3000;
// Middlewares globales
app.use(cors()); // Permite peticiones desde el frontend
app.use(morgan('dev')); // Loguea las peticiones en consola
// --- CONFIGURACIÓN DEL PROXY (EL CORAZÓN DEL GATEWAY) ---
// Definimos a dónde apuntan nuestros microservicios (por ahora a localhost, luego en Docker esto cambiará al nombre del contenedor)
const SERVICES = {
    users: 'http://localhost:3001',
    catalog: 'http://localhost:3002',
    orders: 'http://localhost:3003'
};
// Rutas del proxy
// Si llega una petición a /api/users, la manda al microservicio de usuarios (puerto 3001)
app.use('/api/users', createProxyMiddleware({ 
    target: SERVICES.users, 
    changeOrigin: true,
    pathRewrite: {
        '^/api/users': '', // Le quita el /api/users antes de mandarlo al microservicio
    }
}));
// Si llega a /api/catalog, va al puerto 3002
app.use('/api/catalog', createProxyMiddleware({ 
    target: SERVICES.catalog, 
    changeOrigin: true,
    pathRewrite: {
        '^/api/catalog': '',
    }
}));
// Si llega a /api/orders, va al puerto 3003
app.use('/api/orders', createProxyMiddleware({ 
    target: SERVICES.orders, 
    changeOrigin: true,
    pathRewrite: {
        '^/api/orders': '',
    }
}));
// Ruta base para saber que el Gateway está vivo
app.get('/', (req, res) => {
    res.json({ message: 'Eco-Savor API Gateway is running' });
});
// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 API Gateway corriendo en http://localhost:${PORT}`);
});