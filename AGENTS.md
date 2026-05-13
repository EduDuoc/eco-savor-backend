# Agent Instructions — Eco-Savor Backend

## Architecture

API Gateway (port 3000) + 3 microservices with separate MongoDB databases:

| Service | Port | DB | Patterns |
|---------|------|-----|----------|
| api-gateway | 3000 | — | JWT auth, http-proxy-middleware |
| users | 3001 | ecosaver_users | Repository, Factory Method |
| catalog | 3002 | ecosaver_catalog | Repository |
| orders | 3003 | ecosaver_orders | Repository, Strategy |

**Key constraint:** Controllers NEVER talk directly to models — always through repositories.

## ⚠️ Critical Gotchas

### 1. Express 5 + JWT Middleware Order (API Gateway)

**Problem:** In Express 5, `express-jwt` middleware captures ALL requests before routes if defined first.

**Solution:** Public routes (`/api/auth/login`, `/api/auth/register`) MUST be defined BEFORE the JWT middleware:

```javascript
// ✅ CORRECT order in api-gateway/index.js:
app.use(express.json());

// Public routes FIRST
app.post('/api/auth/register', async (req, res) => {...});
app.post('/api/auth/login', async (req, res) => {...});

// JWT middleware AFTER
app.use('/api/', expressjwt({...}).unless({ path: [...] }));
```

If auth routes return 404, check this order.

### 2. Docker build: `npm ci` requires synced lock files

If `npm ci --omit=dev` fails with "Missing: [package] from lock file":

```powershell
cd api-gateway; npm install; cd ..
cd microservices\users; npm install; cd ..
cd microservices\catalog; npm install; cd ..
cd microservices\orders; npm install; cd ..
```

Then rebuild: `docker compose build --no-cache`

### 3. Missing dependencies in microservices

- **users-service:** needs `express-jwt`, `jsonwebtoken` in dependencies
- **orders-service:** needs `axios` in dependencies
- **catalog-service:** needs `express-jwt`, `jsonwebtoken` in dependencies

Add with: `cd microservices\<service>; npm install <package>; cd ..`

### 4. Bcrypt password hashes corrupt after container rebuild

**Problem:** After rebuilding Docker containers, old users in MongoDB have bcrypt hashes that don't compare correctly (returns `false` even with correct password).

**Solution:** Register a NEW user after any container rebuild. New users will have correct hashes and login will work.

**Why:** bcrypt hashes generated in one container session may not be compatible with bcrypt.compare() in a new container due to encoding or salt differences.

**CRITICAL:** This affects ALL users (including restaurants). If you can't login, register a fresh user. For restaurant features, you MUST register with `role: "restaurant"`.

### 5. Environment files: `.env` vs `.env.docker`

| Service | `.env` (local dev) | `.env.docker` (container) |
|---------|-------------------|--------------------------|
| api-gateway | `localhost:3001` | `users-service:3001` |
| microservices | MongoDB Atlas (prod) | `mongo:27017` (local) |

**Do not commit** `.env` files — they contain MongoDB Atlas credentials.

**MongoDB Docker credentials:**
```
Username: ecosaver
Password: ecosaver_secret
Auth DB: admin
```
Connection string in containers: `mongodb://ecosaver:ecosaver_secret@mongo:27017/<db>?authSource=admin`

## Quick Start

### Docker (recommended — entire ecosystem)

```powershell
# Regenerate lock files first (if deps changed)
cd api-gateway; npm install; cd ..
cd microservices\users; npm install; cd ..
cd microservices\catalog; npm install; cd ..
cd microservices\orders; npm install; cd ..

# Build and run
docker compose up --build -d

# Verify all services are healthy
docker compose ps

# Stop
docker compose down
```

### Local dev (install + run each service separately)

```powershell
cd api-gateway; npm install; npm run dev
cd microservices\users; npm install; npm run dev
cd microservices\catalog; npm install; npm run dev
cd microservices\orders; npm install; npm run dev
```

**PowerShell tips:**
- Use `;` instead of `&&` for chaining commands
- Use `curl.exe` instead of `curl` (PowerShell aliases `curl` to `Invoke-WebRequest`)
- Use single quotes for JSON bodies: `curl.exe -d '{"key":"value"}'`

## Environment Files

Each service has `.env` (local) and `.env.docker` (container):

- **api-gateway:** `.env.docker` uses service names (`users-service:3001`), `.env` uses `localhost`
- **microservices:** `.env` points to MongoDB Atlas (production), `.env.docker` uses local `mongo:27017`

## Testing

Only `users` service has tests implemented:

```bash
cd microservices/users && npm test
```

Uses Jest + `mongodb-memory-server` + `supertest`. Other services have `"test": "echo..."` placeholders.

## Verification — Is the backend working?

```powershell
# 1. Check all containers are healthy
docker compose ps

# 2. Test gateway health
curl.exe http://localhost:3000/health

# 3. Test registration (saves to MongoDB)
curl.exe -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"name":"Test","email":"test@test.com","password":"123456","role":"buyer"}'

# Expected: {"success":true,"data":{"email":"test@test.com",...}}

# 4. Test login (returns JWT)
curl.exe -X POST http://localhost:3000/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"test@test.com","password":"123456"}'

# Expected: {"success":true,"token":"eyJhbGci...",...}

# 5. View logs
docker compose logs -f
```

## Entry Points

- `api-gateway/index.js` — JWT middleware, proxy routes to `/api/users`, `/api/catalog`, `/api/orders`
- `microservices/*/index.js` — Load `.env`, connect DB, mount routes
- All services use Express 5.x, Node 20

## Public Endpoints (no auth)

- `GET /health` — API Gateway health check
- `GET /` — API Gateway info
- `POST /api/auth/register` — Register user (returns success)
- `POST /api/auth/login` — Login (returns JWT)
- `GET /api/catalog/products` — Product catalog (for guests)
- `GET /api/catalog/categories/:category/products` — Products by category
- `GET /api/catalog/restaurants/:restaurantId/products` — Products by restaurant

## Protected Endpoints (require JWT)

- All `/api/users/*` routes (except auth)
- All `/api/orders/*` routes
- `POST/PUT/DELETE /api/catalog/products/*` (GET is public)

## Microservices Direct Access (for debugging)

| Service | Port | Direct URL | Auth Required |
|---------|------|------------|---------------|
| Users | 3001 | `http://localhost:3001/` | ✅ Yes (all routes) |
| Catalog | 3002 | `http://localhost:3002/` | ❌ No (health only) |
| Orders | 3003 | `http://localhost:3003/` | ✅ Yes (all routes) |
| MongoDB | 27017 | `http://localhost:27017/` | ❌ Not HTTP (database) |

**Note:** Microservices return `{"success":false,"error":"Token inválido..."}` when accessed without JWT. This is expected behavior. Use the API Gateway (`:3000`) for normal operations.

## Docker Details

- MongoDB healthcheck: `mongosh --eval "db.adminCommand('ping')"`
- Services wait for Mongo via `depends_on.condition: service_healthy`
- Multi-stage builds: `node:20-alpine`, `npm ci --omit=dev`

## Gotchas

1. **Path rewrite in gateway:** `/api/users` → `` (empty) before proxying
2. **Catalog routes:** mounted at `/products` internally, gateway exposes as `/api/catalog`
3. **JWT_SECRET:** default `ecosaver_dev_secret_change_in_prod` — change for production
4. **No linter/formatter:** repo has no ESLint, Prettier, or type checking
5. **PowerShell:** Use `;` not `&&` for command chaining; use `curl.exe` not `curl`
6. **Express 5 + JWT:** Auth routes MUST be defined before `express-jwt` middleware (returns 404 otherwise)
7. **Catalog public access:** `GET /api/catalog/products` must be public (for guests). Add to gateway JWT `.unless()` paths
8. **Frontend auth loop:** If frontend has infinite reload with "Token inválido", check if catalog endpoint requires auth (it shouldn't)
9. **http-proxy-middleware body forwarding:** In Express 5, `http-proxy-middleware` doesn't forward request body correctly for POST/PUT. Use axios manually for catalog routes instead.
10. **path-to-regexp patterns:** Express 5 uses path-to-regexp v8 which doesn't support `*` or `:param(*)` wildcards. Use explicit routes instead.
