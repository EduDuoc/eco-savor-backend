const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Product = require('./src/models/productModel');
const productRoutes = require('./src/routes/productRoutes');
const connectDB = require('./src/config/database');

let mongoServer;
const app = express();
const JWT_SECRET = 'ecosaver_dev_secret_change_in_prod';

// Helper para generar tokens JWT válidos
const generateToken = (userId, role, restaurantName = 'Test Restaurant') => {
  return jwt.sign(
    { sub: userId, email: 'test@test.com', role, name: 'Test User', restaurantName },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

// Setup similar al index.js
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock de auth middleware para tests (inyecta req.auth directamente)
app.use('/products', (req, res, next) => {
  if (req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.auth = { 
        sub: decoded.sub, 
        role: decoded.role, 
        email: decoded.email,
        name: decoded.name,
        restaurantName: decoded.restaurantName
      };
    } catch (e) {
      // Ignorar errores de auth en tests
    }
  }
  // También inyectar headers X-User-Id si vienen
  if (req.headers['x-user-id']) {
    req.auth = req.auth || {};
    req.auth.sub = req.headers['x-user-id'];
    req.auth.role = req.headers['x-user-role'] || 'restaurant';
    req.auth.name = 'Test User';
    req.auth.restaurantName = 'Test Restaurant';
  }
  next();
});

app.use('/products', productRoutes);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
}, 60000); // 60 segundos para descarga de MongoDB

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await Product.deleteMany({});
});

describe('Catalog Microservice', () => {
  describe('GET /products', () => {
    it('obtiene todos los productos disponibles', async () => {
      // Crear productos de prueba
      await Product.create([
        {
          name: 'Producto 1',
          description: 'Descripción del producto 1',
          price: 100,
          discountPrice: 80,
          quantity: 10,
          category: 'comida caliente',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante Test',
          available: true
        },
        {
          name: 'Producto 2',
          description: 'Descripción del producto 2',
          price: 200,
          discountPrice: 150,
          quantity: 5,
          category: 'bebidas',
          restaurantId: 'rest-2',
          restaurantName: 'Otro Restaurante',
          available: true
        }
      ]);

      const res = await request(app).get('/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
    });

    it('filtra productos por categoría', async () => {
      await Product.create([
        {
          name: 'Hamburguesa',
          description: 'Deliciosa hamburguesa',
          price: 100,
          discountPrice: 80,
          quantity: 10,
          category: 'comida caliente',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante Test',
          available: true
        },
        {
          name: 'Coca Cola',
          description: 'Bebida gaseosa',
          price: 50,
          discountPrice: 40,
          quantity: 20,
          category: 'bebidas',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante Test',
          available: true
        }
      ]);

      const res = await request(app).get('/products?category=comida caliente');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].category).toBe('comida caliente');
    });

    it('solo devuelve productos disponibles por defecto', async () => {
      await Product.create([
        {
          name: 'Producto Disponible',
          description: 'Producto en stock',
          price: 100,
          discountPrice: 80,
          quantity: 10,
          category: 'panadería',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante Test',
          available: true
        },
        {
          name: 'Producto No Disponible',
          description: 'Producto agotado',
          price: 150,
          discountPrice: 120,
          quantity: 0,
          category: 'panadería',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante Test',
          available: false
        }
      ]);

      const res = await request(app).get('/products?available=true');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].name).toBe('Producto Disponible');
    });
  });

  describe('GET /products/my-products', () => {
    it('obtiene solo los productos del restaurante autenticado', async () => {
      // Crear productos de diferentes restaurantes
      await Product.create([
        {
          name: 'Producto Mi Restaurante',
          description: 'Producto de mi restaurante',
          price: 100,
          discountPrice: 80,
          quantity: 10,
          category: 'comida caliente',
          restaurantId: 'rest-123',
          restaurantName: 'Mi Restaurante',
          available: true
        },
        {
          name: 'Producto Otro Restaurante',
          description: 'Producto de otro restaurante',
          price: 200,
          discountPrice: 150,
          quantity: 5,
          category: 'bebidas',
          restaurantId: 'rest-456',
          restaurantName: 'Otro Restaurante',
          available: true
        }
      ]);

      // Generar token JWT válido para el restaurante
      const token = generateToken('rest-123', 'restaurant');
      
      const res = await request(app)
        .get('/products/my-products')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].restaurantId).toBe('rest-123');
    });
  });

  describe('POST /products (crear producto)', () => {
    it('crea un producto correctamente con autenticación', async () => {
      const productData = {
        name: 'Nuevo Producto',
        description: 'Descripción del nuevo producto',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente'
      };

      // Generar token JWT válido
      const token = generateToken('rest-123', 'restaurant');
      
      const res = await request(app)
        .post('/products')
        .set('Authorization', `Bearer ${token}`)
        .send(productData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Nuevo Producto');
      expect(res.body.data.restaurantId).toBe('rest-123');
    });

    it('rechaza crear producto sin autenticación', async () => {
      const productData = {
        name: 'Producto Sin Auth',
        description: 'Producto sin autenticación',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente'
      };

      const res = await request(app)
        .post('/products')
        .send(productData);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /products/:id/deductStock', () => {
    it('descuenta stock correctamente con API key interna', async () => {
      const product = await Product.create({
        name: 'Producto con Stock',
        description: 'Producto con stock para descuento',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente',
        restaurantId: 'rest-123',
        restaurantName: 'Mi Restaurante',
        available: true
      });

      const res = await request(app)
        .put(`/products/${product._id}/deductStock`)
        .set('X-Internal-API-Key', 'ecosaver_internal_key_change_in_prod')
        .send({ quantity: 3 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rechaza descuento de stock sin API key', async () => {
      const product = await Product.create({
        name: 'Producto con Stock',
        description: 'Producto con stock para descuento',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente',
        restaurantId: 'rest-123',
        restaurantName: 'Mi Restaurante',
        available: true
      });

      const res = await request(app)
        .put(`/products/${product._id}/deductStock`)
        .send({ quantity: 3 });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /products/:id', () => {
    it('obtiene un producto por ID', async () => {
      const product = await Product.create({
        name: 'Producto ById',
        description: 'Descripción del producto',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente',
        restaurantId: 'rest-123',
        restaurantName: 'Mi Restaurante',
        available: true
      });

      const res = await request(app).get(`/products/${product._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Producto ById');
    });

    it('devuelve 404 para producto inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/products/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Producto no encontrado');
    });
  });

  describe('PUT /products/:id', () => {
    it('actualiza un producto siendo el dueño', async () => {
      const product = await Product.create({
        name: 'Producto Update',
        description: 'Descripción original',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente',
        restaurantId: 'rest-123',
        restaurantName: 'Mi Restaurante',
        available: true
      });

      const token = generateToken('rest-123', 'restaurant');
      const res = await request(app)
        .put(`/products/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Producto Actualizado', price: 120, discountPrice: 90 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Producto Actualizado');
    });

    it('rechaza actualización sin ser dueño (403)', async () => {
      const product = await Product.create({
        name: 'Producto Ajeno',
        description: 'Descripción',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente',
        restaurantId: 'rest-123',
        restaurantName: 'Mi Restaurante',
        available: true
      });

      const token = generateToken('rest-999', 'restaurant');
      const res = await request(app)
        .put(`/products/${product._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Hackeado' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /products/:id', () => {
    it('elimina un producto siendo el dueño', async () => {
      const product = await Product.create({
        name: 'Producto Delete',
        description: 'Descripción',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente',
        restaurantId: 'rest-123',
        restaurantName: 'Mi Restaurante',
        available: true
      });

      const token = generateToken('rest-123', 'restaurant');
      const res = await request(app)
        .delete(`/products/${product._id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe('Producto eliminado exitosamente');
    });
  });

  describe('GET /products/restaurants/:restaurantId/products', () => {
    it('obtiene productos de un restaurante específico', async () => {
      await Product.create([
        {
          name: 'Producto Rest1 A',
          description: 'Desc A',
          price: 100,
          discountPrice: 80,
          quantity: 10,
          category: 'comida caliente',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante 1',
          available: true
        },
        {
          name: 'Producto Rest1 B',
          description: 'Desc B',
          price: 50,
          discountPrice: 40,
          quantity: 5,
          category: 'bebidas',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante 1',
          available: true
        },
        {
          name: 'Producto Rest2',
          description: 'Desc C',
          price: 200,
          discountPrice: 150,
          quantity: 3,
          category: 'postres',
          restaurantId: 'rest-2',
          restaurantName: 'Restaurante 2',
          available: true
        }
      ]);

      const res = await request(app).get('/products/restaurants/rest-1/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data.every(p => p.restaurantId === 'rest-1')).toBe(true);
    });
  });

  describe('GET /products/categories/:category/products', () => {
    it('obtiene productos por categoría', async () => {
      await Product.create([
        {
          name: 'Coca Cola',
          description: 'Bebida gaseosa',
          price: 50,
          discountPrice: 40,
          quantity: 20,
          category: 'bebidas',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante 1',
          available: true
        },
        {
          name: 'Hamburguesa',
          description: 'Comida caliente',
          price: 100,
          discountPrice: 80,
          quantity: 10,
          category: 'comida caliente',
          restaurantId: 'rest-1',
          restaurantName: 'Restaurante 1',
          available: true
        }
      ]);

      const res = await request(app).get('/products/categories/bebidas/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].category).toBe('bebidas');
    });
  });

  describe('PUT /products/:id/stock', () => {
    it('actualiza el stock de un producto siendo el dueño', async () => {
      const product = await Product.create({
        name: 'Producto Stock',
        description: 'Descripción',
        price: 100,
        discountPrice: 80,
        quantity: 10,
        category: 'comida caliente',
        restaurantId: 'rest-123',
        restaurantName: 'Mi Restaurante',
        available: true
      });

      const token = generateToken('rest-123', 'restaurant');
      const res = await request(app)
        .put(`/products/${product._id}/stock`)
        .set('Authorization', `Bearer ${token}`)
        .send({ quantity: 25 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.quantity).toBe(25);
    });
  });
});
