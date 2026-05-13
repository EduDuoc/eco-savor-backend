const axios = require('axios');

const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL || 'http://localhost:3002';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || 'ecosaver_internal_key_change_in_prod';

/**
 * StockService: Gestiona operaciones de stock con el catálogo
 * Se comunica vía HTTP con el microservicio de catálogo
 */
class StockService {

  /**
   * Valida que todos los items tengan stock suficiente
   * @param {Array} items - Array de items con productId y quantity
   * @throws {Error} Si no hay stock suficiente o producto no disponible
   */
  async validateStock(items) {
    console.log('📦 validateStock - Iniciando validación para', items.length, 'items');
    const stockErrors = [];

    for (const item of items) {
      try {
        console.log('📦 validateStock - Validando item:', item.productId, 'cantidad:', item.quantity);
        
        // Obtener información del producto
        const response = await axios.get(
          `${CATALOG_SERVICE_URL}/products/${item.productId}`,
          { timeout: 10000 }
        );
        
        console.log('📦 validateStock - Response del catálogo:', response.status, response.data?.success);
        const product = response.data.data;

        if (!product) {
          console.warn('📦 validateStock - Producto no encontrado:', item.productId);
          stockErrors.push({
            productId: item.productId,
            productName: 'Producto no encontrado',
            requested: item.quantity,
            available: 0,
            reason: 'Producto no encontrado'
          });
          continue;
        }

        // Verificar disponibilidad
        if (!product.available) {
          console.warn('📦 validateStock - Producto no disponible:', product.name);
          stockErrors.push({
            productId: item.productId,
            productName: product.name,
            requested: item.quantity,
            available: 0,
            reason: 'Producto no disponible'
          });
          continue;
        }

        // Verificar stock suficiente
        if (product.quantity < item.quantity) {
          console.warn('📦 validateStock - Stock insuficiente:', product.name, 'disponible:', product.quantity, 'requerido:', item.quantity);
          stockErrors.push({
            productId: item.productId,
            productName: product.name,
            requested: item.quantity,
            available: product.quantity
          });
        }
      } catch (error) {
        console.error('❌ validateStock - Error validando item:', item.productId, error.code, error.message);
        
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          stockErrors.push({
            productId: item.productId,
            requested: item.quantity,
            available: 0,
            reason: 'Timeout al conectar con el catálogo'
          });
        } else if (error.response?.status === 404) {
          stockErrors.push({
            productId: item.productId,
            requested: item.quantity,
            available: 0,
            reason: 'Producto no encontrado'
          });
        } else {
          // Re-lanzar errores inesperados
          throw error;
        }
      }
    }

    console.log('📦 validateStock - Validación completada. Errores:', stockErrors.length);

    if (stockErrors.length > 0) {
      const error = new Error('Stock insuficiente para algunos productos');
      error.isStockError = true;
      error.details = stockErrors;
      throw error;
    }
  }

  /**
   * Descuenta stock de todos los items atómicamente
   * Si falla uno, hace rollback de todos los anteriores
   * @param {Array} items - Array de items con productId y quantity
   * @throws {Error} Si falla el descuento de stock
   */
  async deductStock(items) {
    const deductedItems = [];

    try {
      for (const item of items) {
        try {
          // Intentar descontar stock
          const response = await axios.put(
            `${CATALOG_SERVICE_URL}/products/${item.productId}/deductStock`,
            { quantity: item.quantity },
            {
              headers: {
                'X-Internal-API-Key': INTERNAL_API_KEY
              }
            }
          );

          if (response.data.success) {
            deductedItems.push(item);
          }
        } catch (error) {
          if (error.response?.status === 409) {
            throw new Error(`Stock insuficiente para ${error.response.data.details?.productName || item.productId}`);
          }
          if (error.response?.status === 404) {
            throw new Error(`Producto no encontrado: ${item.productId}`);
          }
          throw error;
        }
      }
    } catch (error) {
      // Rollback: restaurar stock de los items ya descontados
      if (deductedItems.length > 0) {
        console.error('Error al descontar stock, haciendo rollback...', error.message);
        const rollbackReport = await this.restoreStock(deductedItems);
        
        // Si hubo fallos en el rollback, loguear alerta crítica
        if (rollbackReport.failed.length > 0) {
          console.error('🚨 ROLLBACK FALLÓ PARCIALMENTE - Intervención manual requerida:', rollbackReport.failed);
        }
      }
      throw error;
    }
  }

  /**
   * Restaura stock de los items (rollback o cancelación)
   * @param {Array} items - Array de items con productId y quantity
   * @returns {Object} Reporte de rollback con éxitos y fallos
   */
  async restoreStock(items) {
    const report = {
      restored: [],
      failed: []
    };

    for (const item of items) {
      try {
        await axios.put(
          `${CATALOG_SERVICE_URL}/products/${item.productId}/restoreStock`,
          { quantity: item.quantity },
          {
            headers: {
              'X-Internal-API-Key': INTERNAL_API_KEY
            }
          }
        );
        console.log(`Stock restaurado para producto ${item.productId}: +${item.quantity}`);
        report.restored.push(item.productId);
      } catch (error) {
        console.error(`Error al restaurar stock de ${item.productId}:`, error.message);
        report.failed.push({
          productId: item.productId,
          quantity: item.quantity,
          error: error.message
        });
      }
    }

    // Si hay fallos, loguear alerta crítica
    if (report.failed.length > 0) {
      console.error('⚠️ ROLLBACK PARCIAL: Algunos items no se restauraron:', report.failed);
    }

    return report;
  }
}

module.exports = new StockService();
