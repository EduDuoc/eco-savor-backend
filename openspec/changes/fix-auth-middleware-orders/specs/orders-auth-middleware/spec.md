# Delta for Orders Auth Middleware

## ADDED Requirements

### Requirement: JWT name and restaurantName Mapping in authMiddleware

The `authMiddleware` in `orders/src/middlewares/auth.js` MUST map the `name` and `restaurantName` claims from the decoded JWT payload (`req.auth`) to `req.user` when constructing the `req.user` object after successful JWT verification.

The mappings SHALL coexist with the existing `sub`, `email`, and `role` mappings. If a JWT payload does not contain a `name` or `restaurantName` claim (e.g., tokens issued before this fix), the corresponding `req.user` property MUST be `undefined` — no default or fallback value SHALL be applied at the middleware layer.

#### Scenario: Token with both name and restaurantName claims

- GIVEN a valid JWT containing `name: "Juan"` and `restaurantName: "Panadería Los Andes"`
- WHEN `authMiddleware` processes the request and the token is verified
- THEN `req.user.name` SHALL be `"Juan"`
- AND `req.user.restaurantName` SHALL be `"Panadería Los Andes"`

#### Scenario: Token without restaurantName claim (backward compatibility)

- GIVEN a valid JWT that does NOT contain a `restaurantName` claim
- WHEN `authMiddleware` processes the request and the token is verified
- THEN `req.user.restaurantName` SHALL be `undefined`
- AND `req.user.name`, `req.user.sub`, `req.user.email`, `req.user.role` SHALL be populated normally

#### Scenario: Token without name claim (backward compatibility)

- GIVEN a valid JWT that does NOT contain a `name` claim
- WHEN `authMiddleware` processes the request and the token is verified
- THEN `req.user.name` SHALL be `undefined`
- AND `req.user.restaurantName`, `req.user.sub`, `req.user.email`, `req.user.role` SHALL be populated normally

### Requirement: JWT name and restaurantName Mapping in optionalAuth

The `optionalAuth` middleware in `orders/src/middlewares/auth.js` MUST map the `name` and `restaurantName` claims from the decoded JWT payload (`decoded`) to `req.user` when constructing the `req.user` object after successful JWT verification.

If a JWT payload does not contain a `name` or `restaurantName` claim, the corresponding `req.user` property MUST be `undefined`. If no valid token is provided, `optionalAuth` SHALL call `next()` without setting `req.user` (existing behavior, unchanged).

#### Scenario: Optional auth with name and restaurantName claims

- GIVEN a request with a valid Bearer token containing `name: "María"` and `restaurantName: "Pizzería Juan"`
- WHEN `optionalAuth` processes the request
- THEN `req.user.name` SHALL be `"María"`
- AND `req.user.restaurantName` SHALL be `"Pizzería Juan"`

#### Scenario: Optional auth without token

- GIVEN a request with no Authorization header
- WHEN `optionalAuth` processes the request
- THEN `req.user` SHALL remain unset and `next()` SHALL be called

### Requirement: Consistency with catalog-service auth middleware

The `authMiddleware` and `optionalAuth` in `orders/src/middlewares/auth.js` MUST map the same five JWT fields (`sub`, `email`, `role`, `name`, `restaurantName`) to `req.user` as the equivalent middlewares in `catalog/src/middlewares/auth.js`, ensuring uniform claim propagation across both services.

#### Scenario: Cross-service field mapping consistency

- GIVEN that catalog auth middleware maps `sub`, `email`, `role`, `name`, `restaurantName` to `req.user`
- WHEN orders auth middleware maps the same five fields
- THEN both services SHALL produce `req.user` objects with identical field structure
- AND any field absent from the JWT SHALL be `undefined` in both services

## MODIFIED Requirements

(None — no existing spec for this domain; all changes are additive.)

## REMOVED Requirements

(None — no requirements are being removed.)