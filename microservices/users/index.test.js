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
});

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

      expect(res.status).toBe(500);
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
});
