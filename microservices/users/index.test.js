const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const express = require('express');
const cors = require('cors');
const User = require('./src/models/userModel');
const userRoutes = require('./src/routes/userRoutes');
const connectDB = require('./src/config/database');

let mongoServer;
const app = express();

// Setup similar al index.js
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/users', userRoutes);

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
  await User.deleteMany({});
});

describe('Users Microservice', () => {
  describe('POST /api/users/register', () => {
    it('registra un usuario buyer correctamente', async () => {
      const userData = {
        email: 'buyer@test.com',
        password: 'password123',
        name: 'Test Buyer',
        role: 'buyer',
        phone: '123456789'
      };

      const res = await request(app)
        .post('/api/users/register')
        .send(userData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('buyer@test.com');
      expect(res.body.data.role).toBe('buyer');
    });

    it('registra un usuario restaurant correctamente', async () => {
      const userData = {
        email: 'restaurant@test.com',
        password: 'password123',
        name: 'Test Restaurant',
        role: 'restaurant',
        restaurantName: 'Mi Restaurante',
        phone: '123456789'
      };

      const res = await request(app)
        .post('/api/users/register')
        .send(userData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.restaurantName).toBe('Mi Restaurante');
    });

    it('rechaza registro con email duplicado', async () => {
      const userData = {
        email: 'duplicate@test.com',
        password: 'password123',
        name: 'Test User',
        role: 'buyer'
      };

      await request(app).post('/api/users/register').send(userData);
      const res = await request(app).post('/api/users/register').send(userData);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('rechaza registro con rol inválido', async () => {
      const userData = {
        email: 'invalid@test.com',
        password: 'password123',
        name: 'Test User',
        role: 'admin'
      };

      const res = await request(app).post('/api/users/register').send(userData);

      expect(res.status).toBe(400); // El factory lanza error que se maneja como 400
    });
  });

  describe('POST /api/users/login', () => {
    it('login exitoso con credenciales válidas', async () => {
      const userData = {
        email: 'login@test.com',
        password: 'password123',
        name: 'Test User',
        role: 'buyer'
      };

      await request(app).post('/api/users/register').send(userData);

      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'login@test.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('login@test.com');
    });

    it('rechaza login con contraseña incorrecta', async () => {
      const userData = {
        email: 'wrongpass@test.com',
        password: 'password123',
        name: 'Test User',
        role: 'buyer'
      };

      await request(app).post('/api/users/register').send(userData);

      const res = await request(app)
        .post('/api/users/login')
        .send({ email: 'wrongpass@test.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/users/restaurants', () => {
    it('lista todos los restaurantes (excluye buyers)', async () => {
      await User.create([
        {
          email: 'rest1@test.com',
          password: 'password123',
          name: 'Restaurante Uno',
          role: 'restaurant',
          restaurantName: 'Restaurante Uno'
        },
        {
          email: 'rest2@test.com',
          password: 'password123',
          name: 'Restaurante Dos',
          role: 'restaurant',
          restaurantName: 'Restaurante Dos'
        },
        {
          email: 'buyer-mix@test.com',
          password: 'password123',
          name: 'Comprador Mix',
          role: 'buyer'
        }
      ]);

      const res = await request(app).get('/api/users/restaurants');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data.every(u => u.role === 'restaurant')).toBe(true);
    });

    it('devuelve lista vacía cuando no hay restaurantes', async () => {
      const res = await request(app).get('/api/users/restaurants');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(0);
      expect(res.body.data).toHaveLength(0);
    });
  });

  describe('GET /api/users/:id', () => {
    it('obtiene un usuario por ID', async () => {
      const user = await User.create({
        email: 'byid@test.com',
        password: 'password123',
        name: 'Usuario ById',
        role: 'buyer',
        phone: '555-1234'
      });

      const res = await request(app).get(`/api/users/${user._id}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.email).toBe('byid@test.com');
      expect(res.body.data.name).toBe('Usuario ById');
    });

    it('devuelve 404 para usuario inexistente', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/users/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Usuario no encontrado');
    });
  });
});
