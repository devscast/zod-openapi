# zod-openapi : Decorator-first OpenAPI generation for TypeScript controllers using Zod v4 schemas.

![npm](https://img.shields.io/npm/v/@devscast/zod-openapi?style=flat-square)
![npm](https://img.shields.io/npm/dt/@devscast/zod-openapi?style=flat-square)
[![Lint](https://github.com/devscast/zod-openapi/actions/workflows/lint.yml/badge.svg?branch=main)](https://github.com/devscast/zod-openapi/actions/workflows/lint.yml)
[![Tests](https://github.com/devscast/zod-openapi/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/devscast/zod-openapi/actions/workflows/test.yml)
![GitHub](https://img.shields.io/github/license/devscast/zod-openapi?style=flat-square)

This package is designed for legacy or incremental migrations where documentation should stay as metadata on controller methods instead of becoming application middleware. It uses `@asteasolutions/zod-to-openapi` under the hood and keeps the authoring experience centered on a single `@openapi(...)` decorator.

## Features

- Zod v4+ only
- `@openapi(...)` method decorator
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

```ts
import { generateOpenApiDocument, openapi, z } from "@devscast/zod-openapi";

const UserParamsSchema = z.object({
  user_id: z.string().min(1),
});

const PermissionsSchema = z
  .object({
    permissions: z.array(z.string()),
  })
  .openapi("Permissions");

class UsersController {
  @openapi({
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
            schema: z.object({
              id: UserParamsSchema.shape.user_id,
            }),
          },
        },
      },
    },
  })
  updatePermissions() {
    return null;
  }
}

const document = generateOpenApiDocument({
  controllers: [UsersController],
  document: {
    openapi: "3.0.0",
    info: {
      title: "Example API",
      version: "1.0.0",
    },
  },
});
```

`document.paths` will contain `/api/users/{user_id}/permissions` even though the decorator used the Express-style `:user_id` path.

## Generating a Registry First

If you want to register extra components or mix manual routes with decorated ones, build a registry explicitly:

```ts
import {
  OpenApiGeneratorV3,
  createOpenApiRegistry,
} from "@devscast/zod-openapi";

const registry = createOpenApiRegistry({
  controllers: [UsersController],
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
import { generateOpenApi31Document } from "@devscast/zod-openapi";

const document = generateOpenApi31Document({
  controllers: [UsersController],
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

<a href="https://github.com/devscast/datazen-ts/graphs/contributors" title="show all contributors">
  <img src="https://contrib.rocks/image?repo=devscast/datazen-ts" alt="contributors"/>
</a>
