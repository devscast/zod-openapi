import { describe, expect, it } from "vitest";

import {
  OpenApiGeneratorV3,
  createOpenApiRegistry,
  createRoute,
  generateOpenApi31Document,
  generateOpenApiDocument,
  getControllerOpenApiRoutes,
  getHandlerOpenApiRoutes,
  getRegisteredOpenApiRoutes,
  hasOpenApiMetadata,
  openapi,
  registerOpenApiRoutes,
  toOpenApiPath,
  toRoutingPath,
  z,
} from "../index";

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

const UpdatePermissionsRoute = createRoute({
  description:
    "Update permissions for a specific user by their ID. This endpoint allows modification of the user's permissions.",
  method: "put",
  path: "/api/users/:user_id/permissions",
  request: {
    body: PermissionsSchema,
    params: UserParamsSchema,
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: UpdatePermissionsResponseSchema,
        },
      },
      description: "Retrieve the user",
    },
  },
  summary: "Update User Permissions",
  tags: ["Users"],
});

const listFunctionUsers = openapi({
  method: "get",
  path: "/api/function-users",
  summary: "List function users",
  tags: ["Users"],
})(function listFunctionUsers(limit: number) {
  return { limit };
});

class BaseUsersController {
  @openapi({
    method: "get",
    path: "/api/users/{user_id}",
    request: {
      params: UserParamsSchema,
    },
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              id: UserParamsSchema.shape.user_id,
            }),
          },
        },
        description: "Retrieve the user",
      },
    },
    summary: "Retrieve User",
    tags: ["Users"],
  })
  getUser() {
    return null;
  }
}

class UsersController extends BaseUsersController {
  @openapi(UpdatePermissionsRoute)
  updatePermissions() {
    return null;
  }

  @openapi({
    method: "delete",
    path: "/api/users/:user_id/permissions",
    request: {
      body: {
        contentType: "application/json",
        description: "Optional delete payload",
        required: false,
        schema: z.object({
          hard_delete: z.boolean().default(false),
        }),
      },
      params: UserParamsSchema,
    },
    responses: {
      204: {
        description: "Permissions removed",
      },
    },
    summary: "Delete User Permissions",
    tags: ["Users"],
  })
  deletePermissions() {
    return null;
  }

  @openapi({
    method: "get",
    path: "/api/users/static",
    responses: {
      200: {
        content: {
          "application/json": {
            schema: z.object({
              ok: z.boolean(),
            }),
          },
        },
        description: "Health",
      },
    },
    summary: "Static health route",
    tags: ["Health"],
  })
  static health() {
    return null;
  }
}

describe("createRoute", () => {
  it("keeps the config shape and exposes path helpers", () => {
    expect(UpdatePermissionsRoute).toEqual({
      description:
        "Update permissions for a specific user by their ID. This endpoint allows modification of the user's permissions.",
      method: "put",
      path: "/api/users/:user_id/permissions",
      request: {
        body: PermissionsSchema,
        params: UserParamsSchema,
      },
      responses: {
        200: {
          content: {
            "application/json": {
              schema: UpdatePermissionsResponseSchema,
            },
          },
          description: "Retrieve the user",
        },
      },
      summary: "Update User Permissions",
      tags: ["Users"],
    });
    expect(UpdatePermissionsRoute.getOpenApiPath()).toBe("/api/users/{user_id}/permissions");
    expect(UpdatePermissionsRoute.getRoutingPath()).toBe("/api/users/:user_id/permissions");
    expect(toOpenApiPath("/api/users/:user_id/permissions")).toBe(
      "/api/users/{user_id}/permissions",
    );
    expect(toRoutingPath("/api/users/{user_id}/permissions")).toBe(
      "/api/users/:user_id/permissions",
    );
  });

  it("derives paths from the current route value", () => {
    const definition: { method: "get"; path: string } = {
      method: "get",
      path: "/before/:id",
    };
    const route = createRoute(definition);

    route.path = "/after/:id";

    expect(route.getOpenApiPath()).toBe("/after/{id}");
    expect(route.getRoutingPath()).toBe("/after/:id");
  });
});

describe("decorator metadata", () => {
  it("collects decorated routes from controller classes and instances, including inheritance and statics", () => {
    const fromClass = getControllerOpenApiRoutes(UsersController);
    const fromInstance = getControllerOpenApiRoutes(new UsersController());

    expect(fromClass).toHaveLength(4);
    expect(fromInstance).toHaveLength(4);
    expect(fromClass.map((route) => route.methodName)).toEqual([
      "updatePermissions",
      "deletePermissions",
      "getUser",
      "health",
    ]);
    expect(fromClass.map((route) => route.controllerName)).toEqual([
      "UsersController",
      "UsersController",
      "UsersController",
      "UsersController",
    ]);
    expect(fromClass.find((route) => route.methodName === "health")?.static).toBe(true);
  });

  it("does not inherit a decorated route through an overridden member", () => {
    class BaseController {
      @openapi({
        method: "get",
        path: "/base-handler",
      })
      handler() {
        return "base";
      }

      @openapi({
        method: "get",
        path: "/base-static-handler",
      })
      static staticHandler() {
        return "base";
      }
    }

    class OverrideController extends BaseController {
      override handler() {
        return "override";
      }

      static override staticHandler() {
        return "override";
      }
    }

    expect(getControllerOpenApiRoutes(OverrideController)).toEqual([]);
  });

  it("does not leak metadata when a handler is mounted on another controller", () => {
    class FirstController {
      @openapi({
        method: "get",
        path: "/first-handler",
      })
      handler() {
        return null;
      }
    }

    class SecondController {}

    Object.defineProperty(SecondController.prototype, "handler", {
      configurable: true,
      value: FirstController.prototype.handler,
    });

    expect(getControllerOpenApiRoutes(SecondController)).toEqual([]);
  });

  it("marks decorated handlers and supports stage-3 decorator invocation", () => {
    class StageThreeController {
      handler() {
        return null;
      }
    }

    const decorator = openapi({
      method: "post",
      path: "/stage-three",
      responses: {
        201: {
          description: "Created",
        },
      },
      summary: "Stage three route",
      tags: ["StageThree"],
    });

    decorator(StageThreeController.prototype.handler, {
      access: {
        get() {
          return StageThreeController.prototype.handler;
        },
        has(instance: StageThreeController) {
          return "handler" in instance;
        },
      },
      addInitializer() {},
      kind: "method",
      metadata: undefined,
      name: "handler",
      private: false,
      static: false,
    } as unknown as ClassMethodDecoratorContext<StageThreeController, () => null>);

    expect(hasOpenApiMetadata(StageThreeController.prototype.handler)).toBe(true);
    expect(getControllerOpenApiRoutes(StageThreeController)).toMatchObject([
      {
        methodName: "handler",
        route: {
          method: "post",
          path: "/stage-three",
        },
      },
    ]);
  });

  it("wraps standalone functions without changing their behavior or signature", () => {
    const result: { limit: number } = listFunctionUsers(25);

    expect(result).toEqual({ limit: 25 });
    expect(hasOpenApiMetadata(listFunctionUsers)).toBe(true);
    const registrations = getHandlerOpenApiRoutes(listFunctionUsers);

    expect(registrations[0]?.name).toBe(listFunctionUsers.name);
    expect(registrations).toMatchObject([
      {
        handler: listFunctionUsers,
        kind: "function",
        route: {
          method: "get",
          path: "/api/function-users",
        },
        static: false,
      },
    ]);
    expect(
      getRegisteredOpenApiRoutes().some(
        (registration) => registration.handler === listFunctionUsers,
      ),
    ).toBe(true);
  });
});

describe("document generation", () => {
  it("generates a document from explicit standalone handlers", () => {
    const document = generateOpenApiDocument({
      document: {
        info: {
          title: "Function API",
          version: "1.0.0",
        },
        openapi: "3.0.0",
      },
      handlers: [listFunctionUsers],
    });

    expect(document.paths["/api/function-users"]?.get?.summary).toBe("List function users");
  });

  it("auto-discovers imported decorated methods and functions without duplicates", () => {
    const document = generateOpenApiDocument({
      controllers: [UsersController],
      discovery: "auto",
      document: {
        info: {
          title: "Discovered API",
          version: "1.0.0",
        },
        openapi: "3.0.0",
      },
      handlers: [listFunctionUsers],
    });

    expect(document.paths["/api/function-users"]?.get?.summary).toBe("List function users");
    expect(document.paths["/api/users/{user_id}"]?.get?.summary).toBe("Retrieve User");
  });

  it("rejects explicit handlers without OpenAPI metadata", () => {
    expect(() =>
      createOpenApiRegistry({
        handlers: [() => null],
      }),
    ).toThrow("Handler anonymous has no OpenAPI metadata.");
  });

  it("generates an OpenAPI 3 document from decorated controllers", () => {
    const document = generateOpenApiDocument({
      controllers: [UsersController],
      document: {
        info: {
          title: "Decorator API",
          version: "1.0.0",
        },
        openapi: "3.0.0",
      },
      register(registry) {
        registry.registerComponent("securitySchemes", "bearerAuth", {
          bearerFormat: "JWT",
          scheme: "bearer",
          type: "http",
        });
      },
    });

    expect(document.components?.schemas?.Permissions).toEqual({
      properties: {
        permissions: {
          items: {
            type: "string",
          },
          type: "array",
        },
      },
      required: ["permissions"],
      type: "object",
    });
    expect(document.components?.securitySchemes?.bearerAuth).toEqual({
      bearerFormat: "JWT",
      scheme: "bearer",
      type: "http",
    });

    const updatePermissionsOperation = document.paths["/api/users/{user_id}/permissions"]?.put;

    expect(updatePermissionsOperation?.summary).toBe("Update User Permissions");
    expect(updatePermissionsOperation?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          in: "path",
          name: "user_id",
          required: true,
        }),
      ]),
    );
    expect(updatePermissionsOperation?.requestBody).toEqual({
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/Permissions",
          },
        },
      },
      required: true,
    });

    const deletePermissionsOperation = document.paths["/api/users/{user_id}/permissions"]?.delete;

    expect(deletePermissionsOperation?.requestBody).toEqual({
      content: {
        "application/json": {
          schema: {
            properties: {
              hard_delete: {
                default: false,
                type: "boolean",
              },
            },
            type: "object",
          },
        },
      },
      description: "Optional delete payload",
      required: false,
    });
  });

  it("builds a registry that can mix manual routes with decorator-discovered ones", () => {
    const registry = createOpenApiRegistry({
      controllers: [UsersController],
      routes: [
        {
          method: "get",
          path: "/health",
          responses: {
            200: {
              description: "OK",
            },
          },
          summary: "Health route",
          tags: ["Health"],
        },
      ],
    });

    const document = new OpenApiGeneratorV3(registry.definitions).generateDocument({
      info: {
        title: "Registry API",
        version: "1.0.0",
      },
      openapi: "3.0.0",
    });

    expect(document.paths?.["/health"]?.get?.summary).toBe("Health route");
    expect(document.paths?.["/api/users/static"]?.get?.summary).toBe("Static health route");
  });

  it("rejects duplicate operations after normalizing their paths", () => {
    expect(() =>
      createOpenApiRegistry({
        routes: [
          {
            method: "get",
            path: "/users/:user_id",
          },
          {
            method: "get",
            path: "/users/{user_id}",
          },
        ],
      }),
    ).toThrow("Duplicate OpenAPI operation: GET /users/{user_id}");
  });

  it("rejects duplicate operations already present in a registry", () => {
    const registry = createOpenApiRegistry({
      routes: [
        {
          method: "get",
          path: "/users/:user_id",
        },
      ],
    });

    expect(() =>
      registerOpenApiRoutes(registry, {
        routes: [
          {
            method: "get",
            path: "/users/{user_id}",
          },
        ],
      }),
    ).toThrow("Duplicate OpenAPI operation: GET /users/{user_id}");
  });

  it("generates an OpenAPI 3.1 document", () => {
    const document = generateOpenApi31Document({
      controllers: [UsersController],
      document: {
        info: {
          title: "Decorator API",
          version: "1.0.0",
        },
        openapi: "3.1.0",
      },
    });

    expect(document.openapi).toBe("3.1.0");
    expect(document.paths?.["/api/users/{user_id}"]?.get?.summary).toBe("Retrieve User");
  });
});
