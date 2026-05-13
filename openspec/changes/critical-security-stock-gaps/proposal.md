# Proposal: Critical Security & Stock Management Gaps

## Intent

The Eco-Savor backend has 5 critical gaps that make it unsafe for production: zero stock validation on purchases (overselling), no authentication in microservices (direct port bypass), no restaurant ownership enforcement (any user can CRUD any restaurant's products), no role-based authorization (buyers can create products), and no dedicated public restaurants endpoint. These must be fixed before any real users hit the system.

## Scope

### In Scope
- **Stock validation & deduction**: Validate product stock availability before order creation; atomically deduct stock on confirm; restore stock on cancel/order failure
- **Microservice JWT verification**: Add JWT middleware to users, catalog, and orders services that validates tokens and rejects unauthenticated requests
- **Restaurant ownership middleware**: Verify `restaurantId` on product CRUD matches the authenticated user's ID; reject unauthorized mutations
- **Role-based authorization**: Enforce `restaurant` role for product management endpoints; enforce `buyer` role for order placement; add role-check middleware
- **Gateway proxy for user context**: Forward authenticated user info (`sub`, `role`) as headers to downstream microservices
- **Public restaurants endpoint via gateway**: Expose `GET /api/restaurants` through the gateway (already exists in users service as `GET /api/users/restaurants`)

### Out of Scope
- Rate limiting or throttling
- API versioning
- Password reset / email verification flows
- Admin dashboard or admin role
- Payment integration
- Real-time notifications (WebSocket)
- Testing infrastructure for catalog/orders services (only users has tests)

## Capabilities

### New Capabilities
- `stock-management`: Validate stock availability on order creation; deduct on confirm; restore on cancel/failure
- `microservice-auth`: JWT verification middleware in each microservice + gateway header forwarding
- `ownership-authorization`: Restaurant ownership validation middleware + role-based access control per endpoint

### Modified Capabilities
- None (no existing specs to modify — this is the first SDD change)

## Approach

1. **Gateway auth header forwarding**: After JWT verification, the gateway already has `req.auth` (from `express-jwt`). Add proxy headers `X-User-Id`, `X-User-Role` to every proxied request so downstream services can identify the caller.

2. **Microservice JWT middleware**: Each microservice gets a shared JWT middleware that verifies tokens using the same `JWT_SECRET`. This provides defense-in-depth — even if someone bypasses the gateway, they still need a valid token.

3. **Role + ownership middleware**: Build two Express middlewares:
   - `requireRole(...roles)`: attaches to routes that need specific roles
   - `requireOwnership`: for catalog routes, compares `X-User-Id` header against the product's `restaurantId`
   
4. **Stock validation in order service**: Before creating an order, the orders service calls the catalog service (via internal HTTP) to check stock for each item. On confirm, deduct stock atomically. On cancel, restore stock. Use MongoDB `findOneAndUpdate` with conditions to prevent race conditions.

5. **Restaurants endpoint**: Add a gateway route `GET /api/restaurants` that proxies to the existing users service endpoint. No new service logic needed.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `api-gateway/index.js` | Modified | Add auth header forwarding + restaurants proxy route |
| `microservices/{users,catalog,orders}/src/middlewares/auth.js` | New | JWT verification middleware for each service |
| `microservices/catalog/src/middlewares/ownership.js` | New | Restaurant ownership validation middleware |
| `microservices/catalog/src/routes/productRoutes.js` | Modified | Attach auth & ownership middleware to routes |
| `microservices/orders/src/routes/orderRoutes.js` | Modified | Attach auth & role middleware to routes |
| `microservices/orders/src/services/orderService.js` | Modified | Add stock validation, deduction, and rollback logic |
| `microservices/catalog/src/repositories/productRepository.js` | Modified | Add atomic stock decrement/increment methods |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Stock race condition (two orders for same item simultaneously) | Med | Use MongoDB `findOneAndUpdate` with quantity condition (`quantity >= requested`) — atomic at DB level |
| JWT_SECRET mismatch between gateway and microservices | Low | Share secret via environment variables (already pattern in `.env.docker`); add startup validation |
| Internal service-to-service calls for stock check add latency | Low | Acceptable for MVP; can add caching later |
| Breaking change for existing API consumers | Med | All gateway endpoints already require JWT; microservice endpoints only accessible via gateway — no external consumers bypassing it |

## Rollback Plan

Each change is reversible:
- **Auth middleware**: Remove middleware import from route files; services return to open access
- **Stock logic**: Remove stock validation from orderService; orders create without stock check (current behavior)
- **Proxy headers**: Remove `onProxyReq` callback; gateway stops forwarding user context
- All changes are additive — no data migrations, no schema changes, no destructive operations

## Dependencies

- `jsonwebtoken` already installed in gateway; install in each microservice
- `express-jwt` already used in gateway; install in each microservice
- Internal HTTP calls from orders to catalog require catalog service URL in orders `.env`

## Success Criteria

- [ ] Order creation fails with 409 when product stock is insufficient
- [ ] Order confirmation deducts stock atomically across all items
- [ ] Order cancellation restores stock
- [ ] Direct requests to microservice ports without JWT return 401
- [ ] Restaurant user can CRUD their own products; receives 403 on another restaurant's products
- [ ] Buyer role receives 403 on product creation/update/delete endpoints
- [ ] `GET /api/restaurants` returns all restaurant users through gateway