# Catalog Microservice

Microservicio de gestión de productos y catálogos. Usa el patrón **Repository** para acceso a datos.

## 🎯 Responsabilidades

- CRUD de productos
- Gestión de stock
- Filtrado por categoría, restaurante, disponibilidad
- Descuento atómico de stock (para órdenes)

## 🏗️ Arquitectura

```
┌─────────────┐     HTTP     ┌─────────────┐
│ API Gateway │ ───────────► │   Catalog   │
│             │              │   Service   │
└─────────────┘              │  (puerto    │
                             │   3002)     │
                             └──────┬──────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │   MongoDB   │
                             │ ecosaver_   │
                             │  catalog    │
                             └─────────────┘
```

## 📦 Instalación

```bash
cd microservices/catalog
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
docker compose up catalog-service
```

## 🔧 Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servicio | `3002` |
| `MONGODB_URI` | Conexión a MongoDB | `mongodb://localhost:27017/ecosaver_catalog` |
| `INTERNAL_API_KEY` | API key para service-to-service | `ecosaver_internal_key_change_in_prod` |

## 📝 Endpoints

### Públicos
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/products` | Listar productos disponibles |
| `GET` | `/products/:id` | Obtener producto por ID |
| `GET` | `/products/categories/:category` | Productos por categoría |
| `GET` | `/products/restaurants/:restaurantId` | Productos por restaurante |

### Protegidos (JWT requerido)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/products/my-products` | Obtener MIS productos (restaurant) |
| `POST` | `/products` | Crear producto |
| `PUT` | `/products/:id` | Actualizar producto |
| `DELETE` | `/products/:id` | Eliminar producto |

### Internos (API Key requerida)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `PUT` | `/products/:id/deductStock` | Descontar stock atómico |
| `PUT` | `/products/:id/restoreStock` | Restaurar stock (rollback) |

## 🧪 Testing

```bash
npm test
```

**Tests incluidos:**
- Listar productos (con filtros)
- Obtener productos del restaurante autenticado
- Crear producto con validación
- Descuento de stock con API key
- Rollback en caso de fallo

## 🏷️ Patrones de Diseño

### Repository Pattern
```javascript
// Controller
const products = await productService.list(filters);

// Service
async list(filters) {
  return await productRepository.findAll(filters);
}

// Repository
async findAll(filters) {
  return await Product.find(filters);
}
```

**Beneficios:**
- Controllers no hablan directo con modelos
- Fácil de testear (mock del repository)
- Centraliza lógica de acceso a datos

## 📊 Modelo de Producto

```javascript
{
  name: String,              // Nombre del producto
  price: Number,             // Precio original
  discountedPrice: Number,   // Precio con descuento
  stock: Number,             // Cantidad disponible
  category: String,          // Categoría (comida, bebida, etc.)
  restaurantId: String,      // ID del restaurante dueño
  restaurantName: String,    // Nombre del restaurante
  available: Boolean,        // ¿Está disponible?
  expiresAt: Date,           // Fecha de expiración (opcional)
  imageUrl: String           // URL de la imagen
}
```

## ⚠️ Consideraciones

### Stock Atómico
El descuento de stock usa operaciones atómicas de MongoDB para evitar race conditions.

### API Key Interna
Endpoints de stock requieren `X-Internal-API-Key` header. Solo el orders-service puede llamarlos.

### Restaurant Ownership
Los productos siempre se asocian al restaurante del usuario autenticado (no se confía en el body).

## 📚 Referencias

- [Repository Pattern](https://refactoring.guru/design-patterns/repository)
- [MongoDB Atomic Operations](https://www.mongodb.com/docs/manual/core/transactions/)
