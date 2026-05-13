# Eco-Savor Backend — API Gateway + Microservicios

## Arquitectura

```
┌─────────────────┐
│  API Gateway    │  Puerto 3000
│  + JWT Auth     │  - http-proxy-middleware
│                 │  - express-jwt para autenticación
└────────┬────────┘
         │
    ┌────┼────┬───────────┐
    │    │    │           │
    ▼    ▼    ▼           ▼
 users  catalog  orders   MongoDB
 :3001   :3002   :3003    :27017
```

## Microservicios

| Servicio | Puerto | Base de datos | Patrones |
|----------|--------|---------------|----------|
| **API Gateway** | 3000 | — | API Gateway + JWT |
| **users** | 3001 | `ecosaver_users` | Repository, Factory Method |
| **catalog** | 3002 | `ecosaver_catalog` | Repository |
| **orders** | 3003 | `ecosaver_orders` | Repository, Strategy |

## Patrones de Diseño Implementados

### Backend (3 patrones)

1. **Repository Pattern** (`users/src/repositories/`, `catalog/src/repositories/`, `orders/src/repositories/`)
   - Centraliza el acceso a datos
   - Los controllers NO hablan directo con los modelos

2. **Factory Method** (`users/src/factories/userFactory.js`)
   - Crea diferentes tipos de usuarios según el rol (buyer/restaurant)
   - Encapsula la lógica de creación

3. **Strategy Pattern** (`orders/src/strategies/notificationStrategy.js`)
   - Diferentes estrategias de notificación (Email, SMS, Push)
   - El contexto selecciona la estrategia en runtime

## Quick Start

### Con Docker (recomendado)

```bash
cd ecosavor-backend

# Levantar todo el ecosistema
docker compose up --build

# Ver logs
docker compose logs -f

# Detener
docker compose down
```

### Sin Docker (desarrollo local)

```bash
# Instalar dependencias en cada servicio
cd api-gateway && npm install
cd ../microservices/users && npm install
cd ../catalog && npm install
cd ../orders && npm install

# Levantar cada servicio (en terminales separadas)
cd api-gateway && npm run dev
cd microservices/users && npm run dev
cd microservices/catalog && npm run dev
cd microservices/orders && npm run dev
```

## Endpoints del API Gateway

### Autenticación (públicos)
- `POST /api/auth/login` — Iniciar sesión (devuelve JWT)
- `POST /api/auth/register` — Registrar usuario

### Protegidos (requieren JWT)
- `GET /api/users/:id` — Obtener usuario
- `PUT /api/users/:id` — Actualizar usuario
- `DELETE /api/users/:id` — Eliminar usuario
- `GET /api/catalog/*` — Catálogo de productos
- `POST /api/orders/*` — Crear órdenes
- `GET /api/orders/*` — Consultar órdenes

### Health Check
- `GET /health` — Verificar estado del gateway

## Variables de Entorno

Cada servicio usa `.env` para desarrollo local o `.env.docker` para Docker:

**API Gateway:**
```env
PORT=3000
USERS_SERVICE_URL=http://localhost:3001
CATALOG_SERVICE_URL=http://localhost:3002
ORDERS_SERVICE_URL=http://localhost:3003
JWT_SECRET=tu_secreto_aqui
```

**Microservicios:**
```env
PORT=3001|3002|3003
MONGO_URI=mongodb://localhost:27017/ecosaver_<db>
NODE_ENV=development
```

## Bases de Datos MongoDB

El docker-compose levanta 3 bases de datos separadas:

- `ecosaver_users` — Usuarios y autenticación
- `ecosaver_catalog` — Productos y categorías
- `ecosaver_orders` — Órdenes y reservas

## Testing

```bash
# Cada servicio tiene su propio script de test
cd microservices/users && npm test
cd microservices/catalog && npm test
cd microservices/orders && npm test
```

## Estructura de Carpetas

```
ecosavor-backend/
├── api-gateway/
│   ├── index.js           # Gateway + JWT + proxy
│   ├── package.json
│   └── Dockerfile
├── microservices/
│   ├── users/
│   │   ├── index.js
│   │   ├── src/
│   │   │   ├── config/    # Database connection
│   │   │   ├── models/    # Mongoose schemas
│   │   │   ├── repositories/  # Repository pattern
│   │   │   ├── services/      # Business logic
│   │   │   ├── controllers/   # HTTP handlers
│   │   │   ├── factories/     # Factory method
│   │   │   └── routes/        # Express routes
│   │   └── Dockerfile
│   ├── catalog/ (similar estructura)
│   └── orders/ (similar estructura + strategies/)
├── docker-compose.yml
└── README.md
```

## Justificación Arquitectónica

### ¿Por qué API Gateway y no BFF?

Para este caso de uso (una sola aplicación web), un **API Gateway** es suficiente:
- Centraliza el routing hacia los microservicios
- Agrega autenticación JWT en una capa intermedia
- Evita que el frontend conozca los puertos internos

Un **BFF** sería necesario si tuviéramos múltiples clientes (web, mobile, smart TV) con necesidades de datos diferentes.

### ¿Por qué 3 microservicios?

- **users**: Gestión de usuarios y autenticación (dominio crítico)
- **catalog**: Productos y categorías (lectura intensiva)
- **orders**: Pedidos y reservas (escritura intensiva)

Esta separación permite:
- Escalar independientemente cada servicio
- Deployments independientes
- Diferentes patrones de base de datos por dominio
