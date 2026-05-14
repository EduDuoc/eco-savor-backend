const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const Product = require('./src/models/productModel');
const productRoutes = require('./src/routes/productRoutes');
const connectDB = require('./src/config/database');

let mongoServer;
const app = express();

// Setup similar al index.js
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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

      // Simular autenticación JWT
      const res = await request(app)
        .get('/products/my-products')
        .set('Authorization', 'Bearer fake-token')
        .set('X-User-Id', 'rest-123')
        .set('X-User-Role', 'restaurant');

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

      // Simular autenticación JWT con token válido (el middleware de auth lo valida)
      const res = await request(app)
        .post('/products')
        .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJyZXN0LTEyMyIsImVtYWlsIjoidGVzdEB0ZXN0LmNvbSIsInJvbGUiOiJyZXN0YXVyYW50IiwibmFtZSI6Ik1pIFJlc3RhdXJhbnRlIiwiaWF0IjoxNjAwMDAwMDAwfQ.fake-signature')
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
});
