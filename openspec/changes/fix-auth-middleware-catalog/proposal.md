# Proposal: Fix Auth Middleware Catalog — restaurantName Mapping

## Intent

The JWT token includes `restaurantName` (set in api-gateway line 62), but the catalog auth middleware does NOT map this field to `req.user`. When `productController.createProduct` reads `req.user?.restaurantName`, it gets `undefined` and silently falls back to `req.user?.name` (person name). This causes products to have the **wrong restaurant name** — e.g., "Juan Perez" instead of "Pizzeria Juan". Same bug exists in `optionalAuth`.

## Scope

### In Scope
- Add `restaurantName` mapping to `req.user` in `authMiddleware` (catalog)
- Add `restaurantName` mapping to `req.user` in `optionalAuth` (catalog)

### Out of Scope
- Orders service auth middleware (orders get `restaurantName` from cart items, not JWT)
- Any other JWT claim additions
- Refactoring the auth middleware pattern across services

## Capabilities

### New Capabilities
- None

### Modified Capabilities
- None — no existing specs to modify (no `openspec/specs/` directory yet)

## Approach

Add `restaurantName: req.auth.restaurantName` to the `req.user` object in both middleware functions. In `optionalAuth`, add `restaurantName: decoded.restaurantName`. This is a one-line fix in two functions that ensures the JWT claim propagates correctly to downstream controllers.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `microservices/catalog/src/middlewares/auth.js` L69-76 | Modified | Add `restaurantName` to `req.user` mapping in `authMiddleware` |
| `microservices/catalog/src/middlewares/auth.js` L98-103 | Modified | Add `restaurantName` to `req.user` mapping in `optionalAuth` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| `restaurantName` claim missing from older tokens (users logged in before fix) | Low | `req.user.restaurantName` will be `undefined`; controller fallback `req.user?.name` still works — no regression, just no improvement for old sessions |
| Existing tests break | Low | Tests mock `req.auth` directly; adding a field won't break assertions that don't check it |

## Rollback Plan

Remove the two added lines. Products revert to using person `name` as restaurant name (current broken behavior). No data migration needed — no schema changes.

## Dependencies

- None — purely additive change, no new packages

## Success Criteria

- [ ] `req.user.restaurantName` is populated from JWT claim after `authMiddleware`
- [ ] `req.user.restaurantName` is populated from JWT claim after `optionalAuth`
- [ ] `productController.createProduct` uses `restaurantName` instead of falling back to `name`
- [ ] Existing catalog tests pass without modification