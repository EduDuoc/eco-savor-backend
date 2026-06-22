# Users Microservice

Microservicio de gestión de usuarios. Usa patrones **Repository** y **Factory Method** para la creación de usuarios según su rol.

## 🎯 Responsabilidades

- Registro de usuarios (compradores y restaurantes)
- Autenticación (login con validación de credenciales)
- Gestión del perfil de usuario
- Listado de restaurantes disponibles

## 🏗️ Arquitectura

```
┌─────────────┐     HTTP     ┌─────────────┐
│ API Gateway │ ───────────► │    Users     │
│             │              │   Service   │
└─────────────┘              │  (puerto    │
                             │   3001)     │
                             └──────┬──────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │   MongoDB   │
                             │ ecosaver_   │
                             │   users     │
                             └─────────────┘
```

## 🛠️ Tecnologías

- **Node.js 20** + **Express 5**
- **MongoDB** + **Mongoose** (ODM)
- **JWT** (`jsonwebtoken` + `express-jwt`) para autenticación
- **bcryptjs** para hashear y comparar contraseñas
- **dotenv** para variables de entorno
- **Jest** + **mongodb-memory-server** + **supertest** para testing

## 📁 Estructura de Carpetas

```
microservices/users/
├── index.js                # Entry point: Express, middlewares, rutas
├── index.test.js           # Tests de integración
└── src/
    ├── config/             # Conexión a MongoDB
    ├── controllers/        # Manejo de requests HTTP (sin lógica de negocio)
    ├── factories/          # Factory Method: creación de usuarios por rol
    ├── middlewares/        # Autenticación JWT
    ├── models/             # Esquemas de Mongoose
    ├── repositories/       # Acceso a datos (única capa que toca el modelo)
    ├── routes/             # Definición de rutas
    └── services/           # Lógica de negocio
```

## 📦 Instalación

```bash
cd microservices/users
npm install
```

## 🚀 Ejecución

### Local
```bash
npm run dev
```

### Producción
```bash
npm start
```

### Docker
```bash
cd ecosavor-backend
docker compose up users-service
```

> **Nota:** Este servicio está incluido en el `docker-compose.yml` general del backend junto con `mongo`, `catalog-service`, `orders-service` y `api-gateway`. Levantar todo el stack con `docker compose up --build -d`.

## 🔧 Variables de Entorno

| Variable | Descripción | Default |
|----------|-------------|---------|
| `PORT` | Puerto del servicio | `3001` |
| `MONGO_URI` | Conexión a MongoDB | `mongodb://localhost:27017/ecosaver_users` |
| `JWT_SECRET` | Secreto para validar JWT (debe ser el MISMO que el api-gateway) | `ecosaver_dev_secret_change_in_prod` |
| `NODE_ENV` | Entorno de ejecución | `development` |

> ⚠️ **Importante:** `JWT_SECRET` debe coincidir exactamente con el del `api-gateway`. Si difieren, los tokens emitidos por el gateway serán rechazados por este servicio.

## 📝 Endpoints

Las rutas se montan internamente en `/api/users`.

### Públicos (sin autenticación)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/users/register` | Registrar usuario (`buyer` o `restaurant`) |
| `POST` | `/api/users/login` | Autenticar credenciales y retornar datos del usuario |
| `GET` | `/api/users/restaurants` | Listar todos los restaurantes |

### Protegidos (JWT requerido)
| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `GET` | `/api/users/:id` | Obtener usuario por ID (sin password) |
| `PUT` | `/api/users/:id` | Actualizar perfil (no permite cambiar email, password ni role) |
| `DELETE` | `/api/users/:id` | Eliminar usuario |

## 🧪 Testing

```bash
npm test
```

El script ejecuta `jest --coverage`. Usa **mongodb-memory-server** (MongoDB en memoria) y **supertest** para tests de integración reales sin tocar la base de datos de desarrollo.

**Tests incluidos:**
- Registrar usuario `buyer` correctamente
- Registrar usuario `restaurant` correctamente
- Rechazar registro con email duplicado (409)
- Rechazar registro con rol inválido (400)
- Login exitoso con credenciales válidas
- Rechazar login con contraseña incorrecta (401)

## 🏷️ Patrones de Diseño

### Repository Pattern
```javascript
// Controller (sin lógica de negocio)
const newUser = await userService.register(userData);

// Service (lógica de negocio + factory)
async register(userData) {
  const userToCreate = userFactory.create(userData);
  const existingUser = await userRepository.findByEmail(userToCreate.email);
  if (existingUser) throw new Error('El email ya está registrado');
  return await userRepository.create(userToCreate);
}

// Repository (única capa que toca el modelo)
async create(userData) {
  const user = new User(userData);
  return await user.save();
}
```

**Beneficios:**
- Controllers no hablan directo con modelos
- Fácil de testear (mock del repository)
- Centraliza la lógica de acceso a datos

### Factory Method Pattern
```javascript
// Factory Method: crea el usuario según el rol
class UserFactory {
  create(data) {
    if (!['restaurant', 'buyer'].includes(data.role)) {
      throw new Error('El rol debe ser "restaurant" o "buyer"');
    }
    switch (data.role) {
      case 'restaurant': return this.createRestaurant(data);
      case 'buyer':      return this.createBuyer(data);
    }
  }

  createBuyer(data)      { /* datos base + role: 'buyer' */ }
  createRestaurant(data) { /* datos base + role: 'restaurant' + restaurantName */ }
}
```

**Beneficios:**
- Encapsula la lógica de creación según el rol
- Fácil agregar nuevos tipos de usuario sin tocar el service
- Cada tipo de usuario se construye de forma aislada y testeable

### Singleton
`userService`, `userRepository` y `userFactory` se exportan como instancias únicas (`module.exports = new ...`).

## 📊 Modelo de Usuario

```javascript
{
  email: String,           // Único, lowercase, trim
  password: String,        // Hasheado con bcrypt (pre-save hook)
  name: String,            // Nombre del usuario o restaurante
  role: String,            // 'restaurant' | 'buyer'
  restaurantName: String,  // Requerido para role: 'restaurant'
  address: String,         // Dirección (opcional)
  phone: String,           // Teléfono (opcional)
  createdAt: Date,         // Auto (timestamps)
  updatedAt: Date          // Auto (timestamps)
}
```

**Hooks del modelo:**
- `pre('save')`: hashea el password con `bcrypt` (salto 10) solo si fue modificado
- `comparePassword(candidatePassword)`: método de instancia para validar login

## ⚠️ Consideraciones

### Hash de Contraseñas
El password se hashea automáticamente en el hook `pre('save')` de Mongoose con bcryptjs. Nunca se almacena ni se retorna en texto plano.

### Emisión del JWT
Este microservicio **valida credenciales** en `/login` pero **no emite el JWT**. El token lo emite el `api-gateway` (que maneja `/api/auth/login`). El `users-service` solo verifica tokens usando `express-jwt` con el mismo `JWT_SECRET`.

### Rutas Públicas
El middleware de autenticación (`authMiddleware`) usa un whitelist de rutas públicas: `/`, `/api/users/register`, `/api/users/login` y `/api/users/restaurants`. El resto requiere JWT.

### Actualización de Perfil
`PUT /api/users/:id` filtra explícitamente `email`, `password` y `role` del body — estos campos no se pueden actualizar desde este endpoint.

### Bcrypt tras rebuild de contenedores
Los hashes de bcrypt generados en una sesión de contenedor pueden no comparar correctamente tras un rebuild. Registrar un usuario nuevo después de reconstruir los contenedores. (Ver `AGENTS.md` del backend, gotcha #4.)

## 📚 Referencias

- [Repository Pattern](https://refactoring.guru/design-patterns/repository)
- [Factory Method Pattern](https://refactoring.guru/design-patterns/factory-method)
- [JWT (jsonwebtoken)](https://github.com/auth0/node-jsonwebtoken)
- [bcryptjs](https://github.com/dcodeIO/bcrypt.js)
