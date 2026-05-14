# Orders Microservice

Microservicio de gestión de órdenes. Usa patrones **Repository** y **Strategy** para notificaciones.

## 🎯 Responsabilidades

- Creación y gestión de órdenes
- Validación de stock (vía HTTP al catalog-service)
- Notificaciones a clientes (email, SMS, push)
- Flujo de estados de órdenes

## 🏗️ Arquitectura

```
┌─────────────┐     HTTP     ┌─────────────┐
│ API Gateway │ ───────────► │   Orders    │
│             │              │   Service   │
└─────────────┘              │  (puerto    │
                             │   3003)     │
                             └──────┬──────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
             ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
             │   MongoDB   │ │   Catalog   │ │  Notifica-  │
             │ ecosaver_   │ │   Service   │ │  ciones     │
             │  orders     │ │  (HTTP)     │ │  (Strategy) │
             └─────────────┘ └─────────────┘ └─────────────┘
```

## 📦 Instalación

```bash
cd microservices/orders
npm install
```

## 🚀 Ejecución

### Local
```bash
npm run dev
```

### Docker
```bash
cd ecosavor-backend
docker compose up orders-service
```

## 🔧 Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servicio | `3003` |
| `MONGODB_URI` | Conexión a MongoDB | `mongodb://localhost:27017/ecosaver_orders` |
| `CATALOG_SERVICE_URL` | URL del catalog-service | `http://localhost:3002` |
| `INTERNAL_API_KEY` | API key para service-to-service | `ecosaver_internal_key_change_in_prod` |

## 📝 Endpoints

Todos requieren **JWT**.

### Órdenes
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/orders` | Crear orden |
| `GET` | `/api/orders` | Listar mis órdenes |
| `GET` | `/api/orders/:id` | Obtener orden por ID |
| `PUT` | `/api/orders/:id` | Actualizar orden completa |
| `PUT` | `/api/orders/:id/status` | Actualizar estado |

### Flujo de Estados
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/orders/:id/confirm` | Confirmar orden (descuenta stock) |
| `POST` | `/api/orders/:id/preparing` | Marcar como en preparación |
| `POST` | `/api/orders/:id/ready` | Marcar como lista |
| `POST` | `/api/orders/:id/complete` | Completar orden |
| `POST` | `/api/orders/:id/cancel` | Cancelar orden (restaura stock) |

## 🧪 Testing

```bash
npm test
```

**Tests incluidos:**
- Crear orden con validación de items
- Listar órdenes por usuario/restaurante
- Actualizar estado de orden
- Confirmar orden (cambia a confirmed)
- Cancelar orden (restaura stock si corresponde)

## 🏷️ Patrones de Diseño

### Repository Pattern
```javascript
// Controller
const order = await orderService.create(orderData, userId);

// Service
async create(orderData, userId) {
  await stockService.validateStock(orderData.items);
  const order = await orderRepository.create(orderData);
  return order;
}

// Repository
async create(orderData) {
  return await Order.create(orderData);
}
```

### Strategy Pattern (Notificaciones)
```javascript
// Estrategias intercambiables
class EmailNotification { notify() { /* enviar email */ } }
class SMSNotification { notify() { /* enviar SMS */ } }
class PushNotification { notify() { /* enviar push */ } }

// Contexto
class NotificationService {
  setStrategy(strategy) {
    this.strategy = strategy;
  }
  
  async notify(order, message) {
    await this.strategy.notify(order, message);
  }
}
```

**Beneficios:**
- Cambiar estrategia de notificación en runtime
- Fácil agregar nuevas estrategias (WhatsApp, Slack, etc.)
- Cada estrategia está aislada y testeable

## 📊 Modelo de Orden

```javascript
{
  userId: String,              // ID del cliente
  restaurantId: String,        // ID del restaurante
  restaurantName: String,      // Nombre del restaurante
  items: [{
    productId: String,
    name: String,
    price: Number,
    quantity: Number
  }],
  totalAmount: Number,         // Total de la orden
  status: String,              // pending, confirmed, preparing, ready, completed, cancelled
  orderType: String,           // standard, scheduled
  scheduledTime: Date,         // Hora programada (opcional)
  customerName: String,
  customerPhone: String,
  notes: String                // Notas para el restaurante
}
```

## 🔄 Flujo de Estados

```
┌─────────┐
│ pending │ ◄── Usuario crea orden
└────┬────┘
     │
     │ Restaurant confirma
     ▼
┌─────────────┐
│ confirmed   │ ◄── Stock descontado
└─────┬───────┘
      │
      │ Restaurant prepara
      ▼
┌─────────────┐
│ preparing   │
└─────┬───────┘
      │
      │ Orden lista
      ▼
┌─────────────┐
│    ready    │
└─────┬───────┘
      │
      │ Cliente retira
      ▼
┌─────────────┐
│  completed  │
└─────────────┘
```

**Cancelación:**
- Si cancela en `pending`: no afecta stock
- Si cancela en `confirmed`/`preparing`/`ready`: **restaura stock automáticamente**

## ⚠️ Consideraciones

### Validación de Stock
Antes de crear la orden, se valida stock con el catalog-service. Si no hay stock, la orden se rechaza.

### Descuento de Stock
El stock se descuenta **al confirmar** la orden, no al crearla. Esto permite al restaurante rechazar órdenes sin afectar inventario.

### Restauración de Stock
Si una orden confirmada se cancela, el stock se restaura automáticamente (rollback).

### Service-to-Service
La comunicación con catalog-service usa API key interna (`X-Internal-API-Key`) para endpoints críticos.

## 📚 Referencias

- [Repository Pattern](https://refactoring.guru/design-patterns/repository)
- [Strategy Pattern](https://refactoring.guru/design-patterns/strategy)
- [State Machine](https://en.wikipedia.org/wiki/Finite-state_machine)
