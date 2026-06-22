/**
 * Tests unitarios para errorHandler.js
 * Verifica que los errores de proxy generen respuestas con el formato correcto.
 */

const { handleProxyError } = require('../src/errorHandler');

describe('Error Handler', () => {
  let mockRes;

  beforeEach(() => {
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  it('devuelve 500 y mensaje genérico para errores sin respuesta HTTP', () => {
    const error = new Error('Connection refused');

    handleProxyError(error, mockRes, 'Users');

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Error en Users',
    });
  });

  it('devuelve el status y mensaje del error de axios cuando existe response', () => {
    const error = new Error('Not Found');
    error.response = {
      status: 404,
      data: { error: 'Usuario no encontrado' },
    };

    handleProxyError(error, mockRes, 'Users');

    expect(mockRes.status).toHaveBeenCalledWith(404);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Usuario no encontrado',
    });
  });

  it('usa el nombre del servicio en el mensaje por defecto', () => {
    const error = new Error('Timeout');

    handleProxyError(error, mockRes, 'Catalog');

    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Error en Catalog',
    });
  });

  it('usa "servicio" como nombre por defecto si no se especifica', () => {
    const error = new Error('Unknown');

    handleProxyError(error, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: 'Error en servicio',
    });
  });

  it('devuelve 503 cuando el error tiene status 503', () => {
    const error = new Error('Service Unavailable');
    error.response = {
      status: 503,
      data: { error: 'Servicio no disponible' },
    };

    handleProxyError(error, mockRes, 'Orders');

    expect(mockRes.status).toHaveBeenCalledWith(503);
  });
});
