/**
 * Tests de integración para las rutas de auth del API Gateway
 * (/api/auth/login y /api/auth/register).
 *
 * Se mockea el circuit breaker para controlar exactamente qué responde
 * users-service, sin depender de red real ni de opossum.
 */

const request = require('supertest');

jest.mock('../src/circuitBreaker', () => ({
  usersBreaker: { fire: jest.fn() },
  catalogBreaker: { fire: jest.fn() },
  ordersBreaker: { fire: jest.fn() },
  getBreakerStats: jest.fn().mockReturnValue({}),
}));

const { usersBreaker } = require('../src/circuitBreaker');
const app = require('../index');

afterEach(() => {
  jest.clearAllMocks();
});

describe('API Gateway — POST /api/auth/login', () => {
  it('propaga un 401 de users-service como error, sin firmar ningún JWT', async () => {
    usersBreaker.fire.mockResolvedValueOnce({
      status: 401,
      data: { success: false, error: 'Email o contraseña incorrectos' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'buyer@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeUndefined();
  });

  it('propaga un 400 de users-service como error, sin firmar ningún JWT', async () => {
    usersBreaker.fire.mockResolvedValueOnce({
      status: 400,
      data: { success: false, error: 'Datos inválidos' },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'buyer@test.com', password: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.token).toBeUndefined();
  });

  it('firma un JWT válido cuando users-service responde 200', async () => {
    usersBreaker.fire.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        data: { id: 'user-1', email: 'buyer@test.com', name: 'Buyer', role: 'buyer' },
      },
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'buyer@test.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeDefined();
  });
});

describe('API Gateway — POST /api/auth/register', () => {
  it('propaga un 409 de users-service (email duplicado) con el status real', async () => {
    usersBreaker.fire.mockResolvedValueOnce({
      status: 409,
      data: { success: false, error: 'El email ya está registrado' },
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@test.com', password: 'password123', name: 'Dup', role: 'buyer' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('propaga un 400 de users-service (rol inválido) con el status real', async () => {
    usersBreaker.fire.mockResolvedValueOnce({
      status: 400,
      data: { success: false, error: 'El rol debe ser "restaurant" o "buyer"' },
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@test.com', password: 'password123', name: 'A', role: 'admin' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('responde 201/200 cuando users-service registra correctamente', async () => {
    usersBreaker.fire.mockResolvedValueOnce({
      status: 201,
      data: { success: true, data: { id: 'user-2', email: 'ok@test.com', role: 'buyer' } },
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'ok@test.com', password: 'password123', name: 'Ok', role: 'buyer' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});
