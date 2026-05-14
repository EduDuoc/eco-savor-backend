const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Order = require('./src/models/orderModel');
const orderRoutes = require('./src/routes/orderRoutes');

let mongoServer;
const app = express();
const JWT_SECRET = 'ecosaver_dev_secret_change_in_prod';

// Helper para generar tokens JWT válidos
const generateToken = (userId, role) => {
  return jwt.sign(
    { sub: userId, email: 'test@test.com', role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

// Setup: middlewares básicos sin auth estricto para tests
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock de auth middleware para tests (inyecta user directamente)
app.use('/api/orders', (req, res, next) => {
  if (req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { sub: decoded.sub, role: decoded.role };
    } catch (e) {
      // Ignorar errores de auth en tests
    }
  }
  next();
});

app.use('/api/orders', orderRoutes);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Order.deleteMany({});
});

describe('Orders Microservice', () => {
  describe('POST /api/orders (crear orden)', () => {
    it('crea una orden correctamente', async () => {
      const orderData = {
        items: [
          {
            productId: 'prod-1',
            name: 'Hamburguesa',
            price: 100,
            quantity: 2,
            restaurantId: 'rest-1',
            restaurantName: 'Mi Restaurante'
          }
        ],
        totalAmount: 200,
        customerName: 'Juan Pérez',
        customerPhone: '123456789',
        pickupTime: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };

      const token = generateToken('user-123', 'buyer');
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    it('rechaza orden sin items', async () => {
      const orderData = {
        totalAmount: 200,
        customerName: 'Juan Pérez',
        pickupTime: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };

      const token = generateToken('user-123', 'buyer');
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders', () => {
    it('obtiene las órdenes del usuario', async () => {
      await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'pending',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('user-123', 'buyer');
      const res = await request(app)
        .get('/api/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/orders/:id/confirm', () => {
    it('confirma una orden pendiente', async () => {
      const order = await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'pending',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('rest-1', 'restaurant');
      const res = await request(app)
        .post(`/api/orders/${order._id}/confirm`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/orders/:id/cancel', () => {
    it('cancela una orden', async () => {
      const order = await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'pending',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('user-123', 'buyer');
      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('cancelled');
    });
  });
});
