const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Order = require('./src/models/orderModel');
const orderRoutes = require('./src/routes/orderRoutes');
const stockService = require('./src/services/stockService');

// Mock del stockService para evitar llamadas HTTP al catalog-service en tests.
// Por defecto, validateStock hace "pass-through" de los items recibidos
// (simula que el catálogo confirma exactamente esos datos). Tests
// específicos pueden sobreescribir esto con mockResolvedValueOnce para
// simular que el catálogo devuelve un precio distinto al enviado por el
// cliente (ver bug de manipulación de precio).
jest.mock('./src/services/stockService', () => ({
  validateStock: jest.fn().mockImplementation(async (items) => items),
  deductStock: jest.fn().mockResolvedValue({ success: true }),
  restoreStock: jest.fn().mockResolvedValue({ success: true })
}));

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
  jest.clearAllMocks();
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

    it('ignora el precio/total manipulado por el cliente y usa el precio real del catálogo', async () => {
      // Simulamos que el catálogo (vía stockService.validateStock) devuelve
      // el precio REAL del producto, distinto al que envía el cliente
      stockService.validateStock.mockResolvedValueOnce([
        {
          productId: 'prod-1',
          name: 'Hamburguesa',
          price: 100, // precio real en el catálogo
          quantity: 2,
          restaurantId: 'rest-1',
          restaurantName: 'Mi Restaurante'
        }
      ]);

      const orderData = {
        items: [
          {
            productId: 'prod-1',
            name: 'Hamburguesa',
            price: 1, // precio manipulado por el cliente
            quantity: 2,
            restaurantId: 'rest-1',
            restaurantName: 'Mi Restaurante'
          }
        ],
        totalAmount: 2, // total manipulado por el cliente
        customerName: 'Atacante',
        pickupTime: new Date(Date.now() + 30 * 60 * 1000).toISOString()
      };

      const token = generateToken('user-999', 'buyer');
      const res = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send(orderData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items[0].price).toBe(100);
      expect(res.body.data.totalAmount).toBe(200);
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

    it('no permite confirmar dos veces (condición de carrera) ni descontar stock más de una vez', async () => {
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

      const [res1, res2] = await Promise.all([
        request(app).post(`/api/orders/${order._id}/confirm`).set('Authorization', `Bearer ${token}`),
        request(app).post(`/api/orders/${order._id}/confirm`).set('Authorization', `Bearer ${token}`)
      ]);

      const statuses = [res1.status, res2.status].sort();
      expect(statuses).toEqual([200, 409]);
      expect(stockService.deductStock).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /api/orders/:id/status (bypass de confirm)', () => {
    it('descuenta stock y marca stockDeducted al pasar a confirmed vía updateStatus', async () => {
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
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(stockService.deductStock).toHaveBeenCalledTimes(1);

      const updated = await Order.findById(order._id);
      expect(updated.stockDeducted).toBe(true);
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

    it('no restaura stock si nunca fue descontado, aunque el estado sea confirmed', async () => {
      // Orden creada directamente en estado 'confirmed' sin pasar por confirm()
      // (stockDeducted queda en su default: false)
      const order = await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'confirmed',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('user-123', 'buyer');
      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(stockService.restoreStock).not.toHaveBeenCalled();
    });

    it('rechaza cancelar una orden ya completada', async () => {
      const order = await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'completed',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('user-123', 'buyer');
      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rechaza cancelar una orden ya cancelada', async () => {
      const order = await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'cancelled',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('user-123', 'buyer');
      const res = await request(app)
        .post(`/api/orders/${order._id}/cancel`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/:id', () => {
    it('obtiene una orden por ID', async () => {
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
        .get(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.items).toHaveLength(1);
    });

    it('devuelve 404 para orden inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const token = generateToken('user-123', 'buyer');
      const res = await request(app)
        .get(`/api/orders/${fakeId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Orden no encontrada');
    });
  });

  describe('PUT /api/orders/:id', () => {
    it('actualiza una orden (rol restaurant)', async () => {
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
        .put(`/api/orders/${order._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ customerName: 'Juan Actualizado', notes: 'Sin cebolla' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.customerName).toBe('Juan Actualizado');
      expect(res.body.data.notes).toBe('Sin cebolla');
    });
  });

  describe('POST /api/orders/:id/preparing', () => {
    it('marca una orden como en preparación', async () => {
      const order = await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'confirmed',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('rest-1', 'restaurant');
      const res = await request(app)
        .post(`/api/orders/${order._id}/preparing`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('preparing');
    });
  });

  describe('POST /api/orders/:id/ready', () => {
    it('marca una orden como lista para retirar', async () => {
      const order = await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'preparing',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('rest-1', 'restaurant');
      const res = await request(app)
        .post(`/api/orders/${order._id}/ready`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ready');
    });
  });

  describe('POST /api/orders/:id/complete', () => {
    it('completa una orden (rol restaurant)', async () => {
      const order = await Order.create({
        userId: 'user-123',
        restaurantId: 'rest-1',
        restaurantName: 'Mi Restaurante',
        items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
        totalAmount: 200,
        status: 'ready',
        customerName: 'Juan',
        pickupTime: new Date()
      });

      const token = generateToken('rest-1', 'restaurant');
      const res = await request(app)
        .post(`/api/orders/${order._id}/complete`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
    });
  });

  describe('PUT /api/orders/:id/status', () => {
    it('actualiza el estado de una orden (rol restaurant)', async () => {
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
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('confirmed');
    });

    it('rechaza estado inválido', async () => {
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
        .put(`/api/orders/${order._id}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'estado_invalido' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/orders/restaurants/:restaurantId/orders', () => {
    it('obtiene las órdenes del restaurante autenticado', async () => {
      await Order.create([
        {
          userId: 'user-123',
          restaurantId: 'rest-1',
          restaurantName: 'Mi Restaurante',
          items: [{ productId: 'prod-1', name: 'Hamburguesa', price: 100, quantity: 2, restaurantId: 'rest-1', restaurantName: 'Mi Restaurante' }],
          totalAmount: 200,
          status: 'pending',
          customerName: 'Juan',
          pickupTime: new Date()
        },
        {
          userId: 'user-456',
          restaurantId: 'rest-2',
          restaurantName: 'Otro Restaurante',
          items: [{ productId: 'prod-2', name: 'Pizza', price: 150, quantity: 1, restaurantId: 'rest-2', restaurantName: 'Otro Restaurante' }],
          totalAmount: 150,
          status: 'pending',
          customerName: 'Ana',
          pickupTime: new Date()
        }
      ]);

      const token = generateToken('rest-1', 'restaurant');
      const res = await request(app)
        .get('/api/orders/restaurants/rest-1/orders')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].restaurantId).toBe('rest-1');
    });
  });
});
