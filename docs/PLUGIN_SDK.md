# Plugin SDK

Each store integration is a `StorePlugin` implementation.

## Contract

Implement methods:

- `login(page, credentials)`
- `navigate_to_coupons(page)`
- `clip_all(page) -> int`

Return behavior is standardized through `StorePlugin.run()`.

## Example

See `cliparr_core.plugins.stores.hannaford`.

## Rules for contributors

- Do not bypass CAPTCHAs or MFA.
- Keep selectors scoped and resilient.
- Capture screenshot on failure for diagnostics.
- Add a basic smoke test with mocked page APIs.

## Registering a plugin

1. Add file in `cliparr_core/plugins/stores/<store>.py`
2. Register with `registry.register(YourPlugin)`
3. Add module path to `load_builtin_plugins()` in registry
4. Add docs entry and support status update
