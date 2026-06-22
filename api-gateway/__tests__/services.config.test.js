/**
 * Tests unitarios para services.config.js
 * Verifica que las URLs de los microservicios se resuelvan correctamente
 * usando variables de entorno y fallbacks.
 */

describe('Services Config', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...OLD_ENV };
    delete process.env.USERS_SERVICE_URL;
    delete process.env.CATALOG_SERVICE_URL;
    delete process.env.ORDERS_SERVICE_URL;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('usa los fallbacks por defecto cuando no hay variables de entorno', () => {
    const { SERVICES } = require('../src/services.config');
    expect(SERVICES.users).toBe('http://localhost:3001');
    expect(SERVICES.catalog).toBe('http://localhost:3002');
    expect(SERVICES.orders).toBe('http://localhost:3003');
  });

  it('usa variables de entorno cuando están definidas', () => {
    process.env.USERS_SERVICE_URL = 'http://users-prod:3001';
    process.env.CATALOG_SERVICE_URL = 'http://catalog-prod:3002';
    process.env.ORDERS_SERVICE_URL = 'http://orders-prod:3003';

    const { SERVICES } = require('../src/services.config');
    expect(SERVICES.users).toBe('http://users-prod:3001');
    expect(SERVICES.catalog).toBe('http://catalog-prod:3002');
    expect(SERVICES.orders).toBe('http://orders-prod:3003');
  });

  it('exporta un objeto SERVICES con las 3 claves requeridas', () => {
    const { SERVICES } = require('../src/services.config');
    expect(Object.keys(SERVICES)).toHaveLength(3);
    expect(SERVICES).toHaveProperty('users');
    expect(SERVICES).toHaveProperty('catalog');
    expect(SERVICES).toHaveProperty('orders');
  });
});
