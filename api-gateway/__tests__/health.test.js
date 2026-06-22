/**
 * Tests de integración para endpoints base del API Gateway.
 * Usa una instancia mínima de Express para evitar el listen().
 */

const request = require('supertest');
const express = require('express');
const { getBreakerStats } = require('../src/circuitBreaker');

// Mock de circuit breaker para tests (sin dependencia de opossum real)
jest.mock('../src/circuitBreaker', () => {
  const actual = jest.requireActual('../src/circuitBreaker');
  return {
    ...actual,
    getBreakerStats: jest.fn().mockReturnValue({
      users: { name: 'Users', state: 'CLOSED', failures: 0, successes: 0 },
      catalog: { name: 'Catalog', state: 'CLOSED', failures: 0, successes: 0 },
      orders: { name: 'Orders', state: 'CLOSED', failures: 0, successes: 0 },
    }),
  };
});

function createTestApp() {
  const app = express();
  app.use(express.json());

  // Health check (misma lógica que index.js)
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'API Gateway',
      timestamp: new Date().toISOString(),
      circuits: getBreakerStats(),
    });
  });

  // Health de circuitos
  app.get('/health/circuits', (req, res) => {
    res.json({
      status: 'ok',
      service: 'API Gateway - Circuit Breakers',
      timestamp: new Date().toISOString(),
      circuits: getBreakerStats(),
    });
  });

  // Ruta base
  app.get('/', (req, res) => {
    res.json({
      message: 'Eco-Savor API Gateway is running',
      endpoints: {
        auth: '/api/auth/login',
        users: '/api/users',
        catalog: '/api/catalog',
        orders: '/api/orders',
        health: '/health',
        circuits: '/health/circuits',
      },
    });
  });

  return app;
}

describe('API Gateway — Endpoints base', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /health', () => {
    it('devuelve status ok con timestamp', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('API Gateway');
      expect(res.body).toHaveProperty('timestamp');
      expect(res.body).toHaveProperty('circuits');
    });

    it('incluye estado de los circuit breakers', async () => {
      const res = await request(app).get('/health');

      expect(res.body.circuits).toHaveProperty('users');
      expect(res.body.circuits).toHaveProperty('catalog');
      expect(res.body.circuits).toHaveProperty('orders');
      expect(res.body.circuits.users.state).toBe('CLOSED');
    });
  });

  describe('GET /health/circuits', () => {
    it('devuelve estado detallado de circuit breakers', async () => {
      const res = await request(app).get('/health/circuits');

      expect(res.status).toBe(200);
      expect(res.body.service).toContain('Circuit Breakers');
      expect(res.body.circuits).toBeDefined();
    });
  });

  describe('GET /', () => {
    it('devuelve mensaje de bienvenida con endpoints disponibles', async () => {
      const res = await request(app).get('/');

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('running');
      expect(res.body.endpoints).toHaveProperty('auth');
      expect(res.body.endpoints).toHaveProperty('catalog');
      expect(res.body.endpoints).toHaveProperty('orders');
    });
  });
});
