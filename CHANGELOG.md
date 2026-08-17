# @devscast/zod-openapi

# 1.1.0 - Support for handlers and auto discovery

- Added typed `openapi(route)(handler)` support for standalone functions, explicit `handlers`, and opt-in runtime discovery for imported decorated routes.
- Fixed controller route discovery so overrides shadow inherited members and decorator metadata does not leak through handlers shared across controllers.
- Added duplicate OpenAPI operation detection after path normalization and kept route path helpers synchronized with mutable route definitions.
- Added migration guidance for adopting function routes and automatic discovery without changing existing controller behavior.
- Migrated the Biome configuration for the updated toolchain and expanded regression coverage for discovery and registration behavior.

# 1.0.0 - Initial Release

- Added a decorator-first OpenAPI library built around `@openapi(...)` metadata on controller methods.
- Added controller discovery, route normalization, registry/document generators, and route path helpers for OpenAPI and Express-style paths.
- Added tests covering decorator registration, inherited/static controller methods, OpenAPI 3.0/3.1 document generation, and Zod v4 request body shorthands.
- Added inline source documentation for the public API and replaced the placeholder README with usage guides and migration examples.
- Removed unstable controller glob support and kept the API focused on explicit controller classes and instances.
- Added a build workflow that waits for lint/typecheck and tests to pass before uploading the `dist` artifact with 5-day retention.
- Adjusted workflow triggers so build auto-runs only on pushes to `main`, while lint and test run on pull requests and pushes to all other branches.
- Updated package/build/test configuration for library publishing and scoped validation to the package source instead of the vendored `references/` folder.
