# Zod Open Api
## Decorator-first OpenAPI generation for TypeScript classes and functions using Zod v4 schemas.

![npm](https://img.shields.io/npm/v/@devscast/zod-openapi?style=flat-square)
![npm](https://img.shields.io/npm/dt/@devscast/zod-openapi?style=flat-square)
[![Lint](https://github.com/devscast/zod-openapi/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/devscast/zod-openapi/actions/workflows/lint.yml)
[![Tests](https://github.com/devscast/zod-openapi/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/devscast/zod-openapi/actions/workflows/test.yml)
![GitHub](https://img.shields.io/github/license/devscast/zod-openapi?style=flat-square)

--- 

This package is designed for legacy or incremental migrations where documentation should stay as metadata on controller methods and route functions instead of becoming application middleware. It uses `@asteasolutions/zod-to-openapi` under the hood and keeps the authoring experience centered on a single `openapi(...)` API.

## Features

- Zod v4+ only
- `@openapi(...)` method decorator and `openapi(...)(handler)` function wrapper
- Explicit controller/handler registration and opt-in automatic discovery
- Request body shorthand for the common JSON case
- OpenAPI 3.0 and 3.1 document generation
- Re-exports `z` with `.openapi(...)` already enabled

## Installation

```bash
bun add @devscast/zod-openapi zod
```

If your project uses legacy decorators, enable them in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true
  }
}
```

## Quick Start

Define a route in its application module. The wrapper attaches OpenAPI metadata and returns the original function with its full TypeScript signature intact:

```ts
// src/routes/users.ts
import { openapi, z } from "@devscast/zod-openapi";

const UserParamsSchema = z.object({
  user_id: z.string().min(1),
});

const PermissionsSchema = z
  .object({
    permissions: z.array(z.string()),
  })
  .openapi("Permissions");

const UpdatePermissionsResponseSchema = z.object({
  id: UserParamsSchema.shape.user_id,
});

export const updatePermissions = openapi({
  method: "put",
  path: "/api/users/:user_id/permissions",
  tags: ["Users"],
  summary: "Update User Permissions",
  description: "Update permissions for a specific user by their ID.",
  request: {
    params: UserParamsSchema,
    body: PermissionsSchema,
  },
  responses: {
    200: {
      description: "Updated permissions",
      content: {
        "application/json": {
          schema: UpdatePermissionsResponseSchema,
        },
      },
    },
  },
})(async function updatePermissions(input: {
  userId: string;
  permissions: string[];
}) {
  return {
    id: input.userId,
  };
});
```

Import the route module and generate the document with automatic discovery:

```ts
// src/openapi.ts
import "./routes/users";

import { generateOpenApiDocument } from "@devscast/zod-openapi";

export const openApiDocument = generateOpenApiDocument({
  discovery: "auto",
  document: {
    openapi: "3.0.0",
    info: {
      title: "Example API",
      version: "1.0.0",
    },
  },
});

console.log(JSON.stringify(openApiDocument, null, 2));
```

`openApiDocument.paths` contains `/api/users/{user_id}/permissions` even though the route used the Express-style `:user_id` path. The registered `Permissions` schema is emitted under `components.schemas` and referenced from the request body.

Automatic discovery is runtime registration, not filesystem scanning. A route module must be imported so that its `openapi(...)` wrapper or decorators execute.

## Explicit Handler Registration

Use `handlers` when you want a document containing a controlled set of function routes. Explicit discovery is the default:

```ts
import { generateOpenApiDocument } from "@devscast/zod-openapi";

import { updatePermissions } from "./routes/users";

const document = generateOpenApiDocument({
  handlers: [updatePermissions],
  document: {
    openapi: "3.0.0",
    info: {
      title: "Example API",
      version: "1.0.0",
    },
  },
});
```

`controllers`, `handlers`, and `routes` can be combined in the same document. Passing a function without OpenAPI metadata under `handlers` throws a descriptive error.

## Controller Routes

Class controllers remain supported for legacy applications and incremental migrations:

```ts
import { generateOpenApiDocument, openapi } from "@devscast/zod-openapi";

class HealthController {
  @openapi({
    method: "get",
    path: "/health",
    tags: ["System"],
    summary: "Health check",
    responses: {
      200: {
        description: "OK",
      },
    },
  })
  health() {
    return { ok: true };
  }
}

const document = generateOpenApiDocument({
  controllers: [HealthController],
  document: {
    openapi: "3.0.0",
    info: {
      title: "Example API",
      version: "1.0.0",
    },
  },
});
```

Controller classes, instances, inherited methods, and static methods are supported. Controller decorators are also included by `discovery: "auto"` after their module has been imported.

## Migration Notes

Existing controller usage remains compatible and the default discovery mode is still `"explicit"`; applications using `controllers: [UsersController]` do not need to change.

- Add standalone routes incrementally with `openapi(route)(handler)` and list them under `handlers`.
- Switch to `discovery: "auto"` only after importing every module that declares documented routes.
- `controllers`, `handlers`, and automatic discovery can be combined. Identical handler registrations are deduplicated.
- Automatic registrations live for the lifetime of the current process. Prefer explicit sources when generating unrelated documents or when tests require strict isolation.
- Duplicate HTTP method/path operations now throw a descriptive error instead of being silently overwritten. Express-style and OpenAPI-style forms such as `/users/:id` and `/users/{id}` are considered the same path.

## Generating a Registry First

If you want to register extra components or mix manual routes with decorated ones, build a registry explicitly:

```ts
import {
  OpenApiGeneratorV3,
  createOpenApiRegistry,
} from "@devscast/zod-openapi";

import "./routes/users";

const registry = createOpenApiRegistry({
  discovery: "auto",
  routes: [
    {
      method: "get",
      path: "/health",
      tags: ["System"],
      summary: "Health check",
      responses: {
        200: {
          description: "OK",
        },
      },
    },
  ],
  register(registry) {
    registry.registerComponent("securitySchemes", "bearerAuth", {
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
  },
});

const document = new OpenApiGeneratorV3(registry.definitions).generateDocument({
  openapi: "3.0.0",
  info: {
    title: "Example API",
    version: "1.0.0",
  },
});
```

## OpenAPI 3.1

Use `generateOpenApi31Document(...)` when you want a 3.1 document:

```ts
import "./routes/users";

import { generateOpenApi31Document } from "@devscast/zod-openapi";

const document = generateOpenApi31Document({
  discovery: "auto",
  document: {
    openapi: "3.1.0",
    info: {
      title: "Example API",
      version: "1.0.0",
    },
  },
});
```

## Contributors

<a href="https://github.com/devscast/zod-openapi/graphs/contributors" title="show all contributors">
  <img src="https://contrib.rocks/image?repo=devscast/zod-openapi" alt="contributors"/>
</a>
