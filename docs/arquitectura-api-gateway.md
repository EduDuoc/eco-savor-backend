# Arquitectura del API Gateway y Circuit Breaker — EcoSavor

## 1. Visión general

El **API Gateway** es el punto de entrada único para todo el frontend. Recibe peticiones en `http://localhost:3000` y las enruta a los microservicios internos. Nadie —ni el frontend ni un cliente externo— habla directamente con los microservicios.

```
┌──────────────┐      ┌─────────────────┐      ┌──────────────────┐
│   Frontend   │─────▶│   API Gateway   │─────▶│  Microservicios   │
│  (React 19)  │      │   (puerto 3000) │      │  users  :3001     │
│              │      │                 │      │  catalog :3002    │
│              │      │  Circuit Breaker│      │  orders  :3003    │
│              │      │  JWT Auth       │      │                   │
└──────────────┘      └─────────────────┘      └──────────────────┘
```

## 2. Responsabilidades del API Gateway

### 2.1 Autenticación centralizada (JWT)

El gateway valida el token JWT **una sola vez** y propaga la identidad del usuario a los microservicios mediante headers:

- `X-User-Id`: ID del usuario autenticado
- `X-User-Role`: rol (`buyer` o `restaurant`)

Los microservicios **no validan el token**. Solo leen los headers que el gateway les envía. Esto evita duplicar lógica de auth en cada servicio.

### 2.2 Rutas públicas vs protegidas

| Tipo | Rutas | Auth |
|------|-------|------|
| Públicas | `/health`, `/api/auth/*`, `GET /api/catalog/products`, `/api/restaurants` | ❌ Sin JWT |
| Protegidas | `/api/users/*`, `/api/orders/*`, `POST/PUT/DELETE /api/catalog/*` | ✅ Requieren JWT |

**Regla crítica en Express 5:** Las rutas públicas deben definirse **ANTES** del middleware `express-jwt`. Si se define al revés, el middleware captura todo y las rutas públicas devuelven 404.

```javascript
// ✅ Orden correcto en index.js
app.post('/api/auth/register', ...);  // ← PÚBLICO primero
app.post('/api/auth/login', ...);     // ← PÚBLICO primero
app.use('/api/', expressjwt({...}));  // ← JWT DESPUÉS
app.post('/api/catalog/products', ...); // ← Protegido
```

### 2.3 Proxy a microservicios

El gateway usa dos estrategias de proxy:

| Estrategia | Dónde se usa | Característica |
|-----------|-------------|----------------|
| `createProxyHandler` (axios) | Catalog, Orders | ✅ Con Circuit Breaker |
| `http-proxy-middleware` | Users, Restaurants | ❌ Sin Circuit Breaker |

**¿Por qué dos?** En Express 5, `http-proxy-middleware` no forwardea correctamente el body en POST/PUT. Para catalog y orders (que reciben POST/PUT constantemente) se creó `createProxyHandler`, un proxy manual con axios que sí forwardea bodies y además integra el Circuit Breaker.

### 2.4 Health checks

```
GET /health          → Estado general + estado de los circuit breakers
GET /health/circuits → Estado detallado de cada circuit breaker
```

## 3. Circuit Breaker — Protección contra fallos en cascada

### 3.1 ¿Qué problema resuelve?

Imaginá que el `users-service` se cae. Sin circuit breaker:

1. El frontend manda una petición de login
2. El gateway intenta conectar con users-service
3. Espera **15 segundos** hasta que da timeout
4. El frontend recibe un error... **15 segundos después**
5. Mientras tanto, 100 usuarios más hicieron login
6. Hay 100 conexiones abiertas esperando timeout
7. El gateway se queda sin conexiones y **se cae él también**

Esto es un **fallo en cascada**: un microservicio caído tira abajo todo el sistema.

### 3.2 ¿Cómo funciona el Circuit Breaker?

El Circuit Breaker tiene **3 estados**, como un disyuntor eléctrico:

```
     ┌──────────┐
     │  CERRADO  │  ← Estado normal. Requests pasan normalmente.
     └─────┬─────┘
           │ demasiados fallos (≥50% en ventana de 10s)
           ▼
     ┌──────────┐
     │  ABIERTO  │  ← Requests se rechazan INMEDIATAMENTE (503).
     └─────┬─────┘   El sistema no pierde tiempo esperando.
           │ después de 30 segundos
           ▼
     ┌────────────┐
     │ HALF-OPEN  │  ← Se permite UN request de prueba.
     └──────┬─────┘
            │ ¿funcionó?
       ┌────┴────┐
       ▼         ▼
    CERRADO    ABIERTO
   (éxito)   (fallo, vuelve a abrir)
```

### 3.3 Configuración actual (por microservicio)

| Parámetro | Valor | Significado |
|-----------|-------|-------------|
| `timeout` | 15s | Tiempo máximo de espera por request |
| `errorThresholdPercentage` | 50% | Abre el circuito si el 50% de requests fallan |
| `resetTimeout` | 30s | Espera 30s antes de probar half-open |
| `rollingCountTimeout` | 10s | Ventana de tiempo para contar fallos |
| `volumeThreshold` | 5 | Mínimo 5 requests antes de evaluar apertura |

### 3.4 ¿Qué hace cuando el circuito está ABIERTO?

```json
// Respuesta inmediata (sin esperar timeout)
HTTP 503 Service Unavailable
{
  "success": false,
  "error": "Servicio Users no disponible temporalmente. Intente nuevamente en unos segundos.",
  "circuitOpen": true
}
```

El frontend recibe esta respuesta **al instante** y puede mostrar un mensaje amigable al usuario en lugar de quedarse colgado 15 segundos.

### 3.5 Eventos y monitoreo

Cada circuit breaker emite eventos que se loguean en consola:

```
🔴 CIRCUIT BREAKER ABIERTO para Users    → detectó fallos, abre circuito
🟡 Circuit breaker HALF-OPEN para Users  → probando si el servicio volvió
🟢 Circuit breaker CERRADO para Users    → servicio recuperado
```

Las estadísticas se pueden consultar en `GET /health/circuits`:

```json
{
  "users": {
    "state": "CLOSED",
    "failures": 0,
    "successes": 142,
    "fallbacks": 0,
    "timeouts": 0,
    "rejected": 0
  }
}
```

### 3.6 Cobertura actual

| Microservicio | Circuit Breaker | Mecanismo de proxy |
|--------------|-----------------|-------------------|
| **users** | ✅ Registro y login | ❌ Resto de rutas (http-proxy-middleware) |
| **catalog** | ✅ Todas las rutas | axios (createProxyHandler) |
| **orders** | ✅ Todas las rutas | axios (createProxyHandler) |

## 4. Escalabilidad

### 4.1 ¿Escalan los microservicios?

**Actualmente no**, la configuración con Docker Compose levanta **1 instancia por microservicio**. Pero la arquitectura está **preparada** para escalar:

- **Stateless:** Ningún microservicio guarda estado en memoria. Toda la sesión está en el token JWT y los datos en MongoDB.
- **Bases de datos separadas:** Cada microservicio usa su propia base de datos (`ecosaver_users`, `ecosaver_catalog`, `ecosaver_orders`). No hay contención entre servicios.
- **Sin afinidad de sesión:** Cualquier instancia de un microservicio puede manejar cualquier request porque no hay sticky sessions.

**Para escalar horizontalmente** bastaría con:

```yaml
# docker-compose.yml — agregar réplicas
catalog-service:
  deploy:
    replicas: 3
```

O usar Docker Swarm / Kubernetes con un balanceador de carga delante.

### 4.2 Límite actual

Con 1 instancia por servicio, el cuello de botella es:
- **CPU/Memoria** del contenedor individual
- **Conexiones simultáneas** a MongoDB (el pool de conexiones de Mongoose tiene un límite por defecto de 100)

## 5. Persistencia de datos

### 5.1 ¿Hay persistencia?

**Sí, total.** Los datos sobreviven a reinicios de contenedores gracias al volumen de Docker:

```yaml
volumes:
  mongo-data:          # volumen nombrado (Docker lo gestiona)
```

Cada microservicio tiene su **propia base de datos** en la misma instancia de MongoDB:

| Microservicio | Base de datos |
|--------------|---------------|
| users | `ecosaver_users` |
| catalog | `ecosaver_catalog` |
| orders | `ecosaver_orders` |

### 5.2 ¿Cuándo se pierden los datos?

**Solo si se elimina el volumen explícitamente:**

```bash
docker compose down -v   # ⚠️ Esto BORRA el volumen y todos los datos
```

Un `docker compose down` normal (sin `-v`) **mantiene** los datos.

### 5.3 Patrón de acceso a datos

Los microservicios usan el **patrón Repository**:
- `Controller` → `Service` → `Repository` → `Model` (Mongoose)
- Los controladores **nunca** hablan directamente con los modelos
- Esto permite cambiar la base de datos (ej: de MongoDB a PostgreSQL) cambiando solo el Repository

## 6. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| API Gateway | Node 20, Express 5, `express-jwt`, `jsonwebtoken` |
| Circuit Breaker | `opossum` v8 |
| Proxy (catálogo/órdenes) | `axios` + `createProxyHandler` manual |
| Proxy (usuarios) | `http-proxy-middleware` v3 |
| Microservicios | Node 20, Express 5, Mongoose 8 |
| Base de datos | MongoDB 7 (Docker) |
| Testing | Jest + `mongodb-memory-server` + `supertest` |
