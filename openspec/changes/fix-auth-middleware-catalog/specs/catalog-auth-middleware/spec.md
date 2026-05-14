# Delta for Catalog Auth Middleware

## ADDED Requirements

### Requirement: JWT restaurantName Mapping in authMiddleware

The `authMiddleware` in `catalog/src/middlewares/auth.js` MUST map the `restaurantName` claim from the decoded JWT payload (`req.auth.restaurantName`) to `req.user.restaurantName` when constructing the `req.user` object after successful JWT verification.

The mapping SHALL coexist with the existing `sub`, `email`, `role`, and `name` mappings. If the JWT payload does not contain a `restaurantName` claim (e.g., tokens issued before the fix), `req.user.restaurantName` MUST be `undefined` — no default or fallback value SHALL be applied at the middleware layer.

#### Scenario: Token with restaurantName claim

- GIVEN a valid JWT containing `restaurantName: "Panadería Los Andes"`
- WHEN `authMiddleware` processes the request and the token is verified
- THEN `req.user.restaurantName` SHALL be `"Panadería Los Andes"`

#### Scenario: Token without restaurantName claim (backward compatibility)

- GIVEN a valid JWT that does NOT contain a `restaurantName` claim
- WHEN `authMiddleware` processes the request and the token is verified
- THEN `req.user.restaurantName` SHALL be `undefined`
- AND downstream controllers using `req.user?.restaurantName || req.user?.name` SHALL fall back to `req.user.name` without error

#### Scenario: Internal API key bypasses JWT

- GIVEN a request with a valid `x-internal-api-key` header
- WHEN `authMiddleware` processes the request
- THEN `next()` SHALL be called without setting `req.user`
- AND no JWT verification or `restaurantName` mapping SHALL occur

### Requirement: JWT restaurantName Mapping in optionalAuth

The `optionalAuth` middleware in `catalog/src/middlewares/auth.js` MUST map the `restaurantName` claim from the decoded JWT payload (`decoded.restaurantName`) to `req.user.restaurantName` when constructing the `req.user` object after successful JWT verification.

If the JWT payload does not contain a `restaurantName` claim, `req.user.restaurantName` MUST be `undefined`. If no valid token is provided, `optionalAuth` SHALL call `next()` without setting `req.user` (existing behavior, unchanged).

#### Scenario: Optional auth with restaurantName claim

- GIVEN a request with a valid Bearer token containing `restaurantName: "Pizzería Juan"`
- WHEN `optionalAuth` processes the request
- THEN `req.user.restaurantName` SHALL be `"Pizzería Juan"`

#### Scenario: Optional auth without token

- GIVEN a request with no Authorization header
- WHEN `optionalAuth` processes the request
- THEN `req.user` SHALL remain unset and `next()` SHALL be called