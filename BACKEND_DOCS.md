# Eco-Savor Backend — Documentación Completa

## 📋 Resumen Ejecutivo

Eco-Savor es una plataforma que conecta restaurantes (venden excedentes de comida) con usuarios (compran más barato). El backend está arquitecturado como **API Gateway + 3 Microservicios** con autenticación JWT, autorización por roles, y gestión atómica de stock.

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│                    API Gateway (Puerto 3000)                     │
│  • JWT Authentication                                           │
│  • Proxy a microservicios                                       │
│  • Header forwarding (X-User-Id, X-User-Role)                   │
│  • Rutas públicas: /api/auth/*, /api/restaurants, /health       │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│ Users Service │   │Catalog Service│   │ Orders Service│
│   Puerto 3001 │   │   Puerto 3002 │   │   Puerto 3003 │
│ ecosaver_users│   │ecosaver_catalog│  │ecosaver_orders│
│ - Auth JWT    │   │ - Auth JWT    │   │ - Auth JWT    │
│ - Roles       │   │ - Ownership   │   │ - Stock Mgmt  │
└───────────────┘   └───────────────┘   └───────────────┘
```

### Patrones de Diseño

| Patrón | Ubicación | Propósito |
|--------|-----------|-----------|
| **Repository** | Todos los servicios | Centralizar acceso a MongoDB |
| **Factory Method** | Users, Orders | Crear objetos según tipo/rol |
| **Strategy** | Orders | Notificaciones (Email, SMS, Push) |
| **API Gateway** | api-gateway | Routing + auth centralizada |
| **Middleware** | Todos los servicios | Auth, roles, ownership |

---

## 🔐 Autenticación y Autorización

### Flujo de Autenticación

1. **Login**: Usuario envía credenciales → `POST /api/auth/login`
2. **Gateway**: Valida credenciales con users service → Genera JWT
3. **JWT Payload**: `{ sub: userId, email, role, exp: 8h }`
4. **Requests protegidos**: Cliente envía `Authorization: Bearer <token>`
5. **Gateway**: Verifica JWT → Inyecta headers `X-User-Id`, `X-User-Role`
6. **Microservicio**: Verifica JWT independientemente (defensa en profundidad)

### Roles del Sistema

| Rol | Permisos |
|-----|----------|
| **buyer** | Ver catálogo, crear órdenes, ver/cancelar sus órdenes |
| **restaurant** | CRUD productos propios, ver/gestionar órdenes de su restaurante |

### Middleware de Auth (por servicio)

```javascript
// microservices/*/src/middlewares/auth.js
- Verifica JWT con express-jwt
- Extrae payload a req.user = { sub, email, role }
- Whitelist de rutas públicas (solo en users: /register, /login, /restaurants)
- Retorna 401 si token inválido/expirado
```

### Middleware de Roles

```javascript
// microservices/{catalog,orders}/src/middlewares/roles.js
- requireRole('restaurant') o requireRole('buyer')
- Verifica req.user.role
- Retorna 403 si rol no autorizado
```

### Middleware de Ownership (Catálogo)

```javascript
// microservices/catalog/src/middlewares/ownership.js
- CREATE: Override de restaurantId con req.user.sub (previene spoofing)
- UPDATE/DELETE: Valida product.restaurantId === req.user.sub
- Retorna 403 si no es el dueño
```

---

## 📦 Gestión de Stock

### Flujo de Compra con Stock

```
1. POST /api/orders (buyer crea orden)
   └─→ StockService.validateStock(items)
       └─→ HTTP GET /products/:id (por cada item)
       └─→ Verifica: available=true && quantity >= requested
       └─→ Si falla → 409 Conflict con detalles

2. Orden creada con status='pending'
   └─→ Stock NO se descuenta aún (evita lock en pending)

3. POST /api/orders/:id/confirm (restaurant confirma)
   └─→ StockService.deductStock(items)
       └─→ HTTP PUT /products/:id/deductStock
       └─→ MongoDB: findOneAndUpdate({_id, quantity: {$gte: qty}}, {$inc: {quantity: -qty}})
       └─→ Si quantity llega a 0 → available=false
       └─→ Si falla → Rollback de items descontados

4. POST /api/orders/:id/cancel (cancelación)
   └─→ Si status ∈ {confirmed, preparing, ready}
       └─→ StockService.restoreStock(items)
           └─→ HTTP PUT /products/:id/restoreStock
           └─→ $inc: {quantity: +qty}
```

### Atomicidad y Race Conditions

**Problema**: Dos órdenes simultáneas podrían consumir el mismo stock.

**Solución**: MongoDB `findOneAndUpdate` con condición `$gte`:

```javascript
// productRepository.deductStock()
await Product.findOneAndUpdate(
  { _id: id, quantity: { $gte: qty } },  // Solo si hay stock suficiente
  { $inc: { quantity: -qty } },
  { new: true }
);
// Retorna null si no hubo match → stock insuficiente
```

---

## 🗂️ Estructura de Carpetas

```
ecosavor-backend/
├── api-gateway/
│   ├── index.js                 # Gateway + JWT + proxy + header forwarding
│   ├── .env.docker              # Config Docker (service names)
│   ├── .env                     # Config local (localhost)
│   └── package.json
│
├── microservices/
│   ├── users/
│   │   ├── index.js             # Entry point + auth middleware
│   │   ├── .env                 # MongoDB Atlas
│   │   ├── .env.docker          # MongoDB local
│   │   └── src/
│   │       ├── config/database.js
│   │       ├── models/userModel.js
│   │       ├── repositories/userRepository.js
│   │       ├── services/userService.js
│   │       ├── controllers/userController.js
│   │       ├── routes/userRoutes.js
│   │       ├── factories/userFactory.js
│   │       └── middlewares/auth.js
│   │
│   ├── catalog/
│   │   ├── index.js             # Entry point + auth middleware
│   │   ├── .env
│   │   ├── .env.docker
│   │   └── src/
│   │       ├── config/database.js
│   │       ├── models/productModel.js
│   │       ├── repositories/productRepository.js
│   │       ├── services/productService.js
│   │       ├── controllers/productController.js
│   │       ├── routes/productRoutes.js
│   │       ├── factories/productFactory.js
│   │       └── middlewares/
│   │           ├── auth.js
│   │           ├── roles.js
│   │           └── ownership.js
│   │
│   └── orders/
│       ├── index.js             # Entry point + auth middleware
│       ├── .env
│       ├── .env.docker
│       └── src/
│           ├── config/database.js
│           ├── models/orderModel.js
│           ├── repositories/orderRepository.js
│           ├── services/
│           │   ├── orderService.js
│           │   └── stockService.js    # HTTP client a catálogo
│           ├── controllers/orderController.js
│           ├── routes/orderRoutes.js
│           ├── factories/orderFactory.js
│           ├── strategies/notificationStrategy.js
│           └── middlewares/
│               ├── auth.js
│               └── roles.js
│
└── docker-compose.yml
```

---

## 🌐 Endpoints del API

### Autenticación (Públicos)

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → Retorna JWT |
| POST | `/api/auth/register` | Registro de usuario (buyer/restaurant) |
| GET | `/api/restaurants` | Listar todos los restaurantes (para frontend) |

### Usuarios (Protegidos)

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| GET | `/api/users/:id` | Auth | Obtener usuario por ID |
| PUT | `/api/users/:id` | Auth | Actualizar perfil |
| DELETE | `/api/users/:id` | Auth | Eliminar usuario |

### Productos (Catálogo)

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/api/catalog/products` | restaurant | Crear producto (auto-asigna restaurantId) |
| GET | `/api/catalog/products` | Público | Listar productos (filtros: restaurantId, category, available) |
| GET | `/api/catalog/products/:id` | Público | Obtener producto |
| PUT | `/api/catalog/products/:id` | restaurant (owner) | Actualizar producto |
| DELETE | `/api/catalog/products/:id` | restaurant (owner) | Eliminar producto |
| PUT | `/api/catalog/products/:id/stock` | restaurant (owner) | Actualizar stock manualmente |
| GET | `/api/catalog/products/restaurants/:id/products` | Público | Productos por restaurante |
| GET | `/api/catalog/products/categories/:cat/products` | Público | Productos por categoría |

### Órdenes

| Método | Ruta | Rol | Descripción |
|--------|------|-----|-------------|
| POST | `/api/orders` | buyer | Crear orden (valida stock) |
| GET | `/api/orders` | Auth | Listar órdenes (filtrado automático por rol) |
| GET | `/api/orders/:id` | Auth | Obtener orden |
| PUT | `/api/orders/:id` | restaurant | Actualizar orden |
| PUT | `/api/orders/:id/status` | restaurant | Cambiar estado |
| POST | `/api/orders/:id/confirm` | restaurant | Confirmar orden (descuenta stock) |
| POST | `/api/orders/:id/preparing` | restaurant | Marcar en preparación |
| POST | `/api/orders/:id/ready` | restaurant | Marcar lista |
| POST | `/api/orders/:id/complete` | restaurant | Completar orden |
| POST | `/api/orders/:id/cancel` | buyer/restaurant | Cancelar (restaura stock si confirmada) |
| GET | `/api/orders/users/:userId/orders` | buyer (propio) | Órdenes de un usuario |
| GET | `/api/orders/restaurants/:id/orders` | restaurant (propio) | Órdenes de un restaurante |

---

## 🔄 Ciclo de Vida de una Orden

```
┌─────────┐
│ pending │ ← Creada (stock validado, NO descontado)
└────┬────┘
     │ POST /confirm
     ▼
┌────────────┐
│ confirmed  │ ← Stock descontado atómicamente
└────┬───────┘
     │ POST /preparing
     ▼
┌────────────┐
│ preparing  │ ← Restaurante preparando
└────┬───────┘
     │ POST /ready
     ▼
┌────────────┐
│ ready      │ ← Lista para retirar
└────┬───────┘
     │ POST /complete
     ▼
┌────────────┐
│ completed  │ ← Finalizada
└────────────┘

Cancelación (desde cualquier estado):
- Si status ∈ {confirmed, preparing, ready} → Restaura stock
- Si status = pending → No restaura (nunca se descontó)
```

---

## 🔑 Variables de Entorno

### API Gateway

```env
PORT=3000
USERS_SERVICE_URL=http://localhost:3001  # Docker: users-service:3001
CATALOG_SERVICE_URL=http://localhost:3002
ORDERS_SERVICE_URL=http://localhost:3003
JWT_SECRET=ecosaver_dev_secret_change_in_prod
INTERNAL_API_KEY=ecosaver_internal_key_change_in_prod
NODE_ENV=development
```

### Microservicios

```env
PORT=3001|3002|3003
MONGO_URI=mongodb://...  # Atlas o local
NODE_ENV=development
INTERNAL_API_KEY=ecosaver_internal_key_change_in_prod  # catalog, orders
CATALOG_SERVICE_URL=http://localhost:3002  # orders
```

---

## 🧪 Testing

```bash
# Users service (implementado)
cd microservices/users && npm test

# Catalog/Orders (pendiente)
cd microservices/catalog && npm test
cd microservices/orders && npm test
```

**Stack de testing:** Jest + mongodb-memory-server + supertest

---

## 🚀 Quick Start

### Con Docker (recomendado)

```bash
docker compose up --build
docker compose logs -f
```

### Local (desarrollo)

```bash
# Instalar dependencias en cada servicio
cd api-gateway && npm install
cd microservices/users && npm install
cd microservices/catalog && npm install
cd microservices/orders && npm install

# Levantar en terminales separadas
cd api-gateway && npm run dev
cd microservices/users && npm run dev
cd microservices/catalog && npm run dev
cd microservices/orders && npm run dev
```

---

## 📝 Decisiones de Diseño Clave

### 1. ¿Por qué stock se descuenta en confirm y no en create?

**Problema**: Si descuentas en create, las órdenes pending "reservan" stock indefinidamente.

**Solución**: Validar en create (asegura que hay stock), descontar en confirm (cuando el restaurante acepta).

### 2. ¿Por qué middleware de auth en cada microservicio si el gateway ya valida?

**Defensa en profundidad**: Si alguien llama directamente al puerto 3002/3003, el servicio se protege solo.

### 3. ¿Por qué restaurantId se auto-asigna desde el token?

**Seguridad**: Previene que un usuario malintencionado envíe `restaurantId: "otro_restaurante"` en el body.

### 4. ¿Por qué HTTP interno entre orders→catalog y no DB compartida?

**Limpieza arquitectónica**: Cada microservicio es dueño de su DB. HTTP preserva boundaries.

---

## 🔒 Seguridad

### Capas de Protección

1. **Gateway**: JWT validation + header forwarding
2. **Microservicio**: JWT re-validation + role checks
3. **Ownership**: Valida que recursos pertenezcan al usuario
4. **Internal APIs**: `X-Internal-API-Key` para comunicación entre servicios

### Headers de Seguridad

| Header | Propósito |
|--------|-----------|
| `Authorization: Bearer <token>` | JWT del cliente |
| `X-User-Id` | ID del usuario (inyectado por gateway) |
| `X-User-Role` | Rol del usuario (inyectado por gateway) |
| `X-Internal-API-Key` | API key para comunicación interna |

---

## 📚 Para Explicarle al Profesor

### Puntos Clave

1. **Arquitectura de microservicios real**: 3 servicios independientes, cada uno con su DB
2. **Seguridad implementada**: JWT + roles + ownership + internal API keys
3. **Gestión atómica de stock**: Race conditions prevenidos con MongoDB operations
4. **Patrones de diseño**: Repository, Factory, Strategy, API Gateway, Middleware
5. **Dockerizado**: Healthchecks, depends_on, multi-stage builds
6. **Escalabilidad**: Servicios deployables independientemente

### ¿Qué lo hace production-ready?

- Autenticación y autorización en cada capa
- Validación de stock antes de vender
- Rollback automático en fallos
- Logging de errores
- Healthchecks para orquestación
- Variables de entorno configurables

---

## 🎯 Conexión con Frontend React

### Endpoints que el frontend necesitará

```javascript
// Auth
POST /api/auth/login → { token, user }
POST /api/auth/register → { user }

// Restaurantes (para dropdown en registro)
GET /api/restaurants → [{ id, name, address }]

// Productos (modo usuario)
GET /api/catalog/products?available=true → [{ id, name, price, quantity, restaurantName }]
GET /api/catalog/products/categories/:cat/products → filtrado por categoría

// Productos (modo restaurante - CRUD)
POST /api/catalog/products → crear
PUT /api/catalog/products/:id → editar
DELETE /api/catalog/products/:id → eliminar

// Órdenes (modo usuario)
POST /api/orders → { items: [{productId, quantity}] }
GET /api/orders/users/:userId/orders → mis órdenes
POST /api/orders/:id/cancel → cancelar

// Órdenes (modo restaurante)
GET /api/orders/restaurants/:id/orders → órdenes de mi restaurante
POST /api/orders/:id/confirm → confirmar
POST /api/orders/:id/preparing → en preparación
POST /api/orders/:id/ready → lista
POST /api/orders/:id/complete → completada
POST /api/orders/:id/cancel → cancelar (restaura stock)
```

### Headers requeridos

```javascript
// Todas las requests protegidas deben incluir:
headers: {
  'Authorization': `Bearer ${token}`
}
```

---

## ✅ Checklist de Funcionalidades

- [x] Login/Registro con JWT
- [x] Roles (buyer/restaurant)
- [x] CRUD productos con ownership
- [x] Catálogo filtrable
- [x] Creación de órdenes con validación de stock
- [x] Descuento atómico de stock al confirmar
- [x] Restauración de stock al cancelar
- [x] Estados de orden (pending → confirmed → preparing → ready → completed)
- [x] Cancelación con rollback de stock
- [x] Listado de restaurantes para frontend
- [x] Autenticación en todos los microservicios
- [x] Autorización por roles
- [x] Validación de ownership

---

**Documentación creada:** 2026-05-13  
**Autor:** Eco-Savor Backend Team  
**Versión:** 1.0.0
