/**
 * Configuración de URLs de microservicios
 * Se exporta un objeto SERVICES con las URLs de cada servicio
 */

const SERVICES = {
  users: process.env.USERS_SERVICE_URL || 'http://localhost:3001',
  catalog: process.env.CATALOG_SERVICE_URL || 'http://localhost:3002',
  orders: process.env.ORDERS_SERVICE_URL || 'http://localhost:3003'
};

module.exports = { SERVICES };
