# EcoSavor API Gateway

**API Gateway** (Backend for Frontend - BFF) construido con Express 5. Centraliza autenticación JWT y routing hacia los microservicios.

## 🎯 Responsabilidades

- **Autenticación JWT**: Valida tokens en todas las requests protegidas
- **Routing**: Proxy de requests a los microservicios correspondientes
- **Autorización**: Inyecta datos del usuario (ID, rol) en headers para los MS

## 🏗️ Arquitectura

```
┌─────────────┐     JWT      ┌─────────────┐
│   Frontend  │ ───────────► │ API Gateway │
└─────────────┘              │  (puerto    │
                             │   3000)     │
                             └──────┬──────┘
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
           ▼                        ▼                        ▼
    ┌─────────────┐          ┌─────────────┐          ┌─────────────┐
    │   Users     │          │   Catalog   │          │   Orders    │
    │   :3001     │          │   :3002     │          │   :3003     │
    └─────────────┘          └─────────────┘          └─────────────┘
```

## 🔐 Middleware JWT

El gateway usa `express-jwt` para validar tokens. **Importante:** Las rutas públicas deben definirse **ANTES** del middleware JWT.

### Rutas Públicas (sin auth)
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/catalog/products` (y sus variantes)
- `GET /health`

### Rutas Protegidas (requieren JWT)
- `/api/users/*` (excepto auth)
- `/api/orders/*`
- `POST/PUT/DELETE /api/catalog/products/*`

## 📦 Instalación

```bash
cd api-gateway
npm install
```

## 🚀 Ejecución

### Local (desarrollo)
```bash
npm run dev
```

### Docker (recomendado)
```bash
cd ecosavor-backend
docker compose up --build
```

## 🔧 Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del gateway | `3000` |
| `JWT_SECRET` | Secreto para JWT | `ecosaver_dev_secret_change_in_prod` |
| `USERS_SERVICE_URL` | URL del users-service | `http://localhost:3001` |
| `CATALOG_SERVICE_URL` | URL del catalog-service | `http://localhost:3002` |
| `ORDERS_SERVICE_URL` | URL del orders-service | `http://localhost:3003` |

## 📝 Endpoints

### Autenticación
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/register` | Registrar usuario | ❌ |
| `POST` | `/api/auth/login` | Login (retorna JWT) | ❌ |

### Usuarios
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/users/restaurants` | Listar restaurantes | ❌ |
| `GET` | `/api/users/:id` | Obtener usuario por ID | ✅ |
| `PUT` | `/api/users/:id` | Actualizar perfil | ✅ |

### Catálogo
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/catalog/products` | Listar productos | ❌ |
| `GET` | `/api/catalog/my-products` | Mis productos (restaurant) | ✅ |
| `POST` | `/api/catalog/products` | Crear producto | ✅ |
| `PUT` | `/api/catalog/products/:id` | Actualizar producto | ✅ |
| `DELETE` | `/api/catalog/products/:id` | Eliminar producto | ✅ |

### Órdenes
| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/orders` | Crear orden | ✅ |
| `GET` | `/api/orders` | Listar mis órdenes | ✅ |
| `POST` | `/api/orders/:id/confirm` | Confirmar orden | ✅ |
| `POST` | `/api/orders/:id/cancel` | Cancelar orden | ✅ |

## 🧪 Testing

```bash
npm test
```

## 🏷️ Patrones de Diseño

- **API Gateway Pattern**: Centraliza autenticación y routing
- **Middleware Chain**: JWT validation antes de cada request protegida
- **Proxy Pattern**: Reenvío de requests a microservicios

## ⚠️ Consideraciones

### Express 5 + JWT
En Express 5, `express-jwt` captura TODAS las requests si se define antes que las rutas. **Siempre** definir rutas públicas primero.

### Timeout en Requests
Las requests a microservicios tienen timeout de 30 segundos para evitar hanging requests.

### API Key Interna
El descuento de stock usa `X-Internal-API-Key` para comunicación service-to-service.

## 📚 Referencias

- [Express 5 Documentation](https://expressjs.com/)
- [express-jwt](https://github.com/auth0/express-jwt)
- [http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)
