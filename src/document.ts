import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { toOpenApiPath } from "./create-route";
import {
  collectOpenApiRoutes,
  getHandlerOpenApiRoutes,
  getRegisteredOpenApiRoutes,
} from "./metadata";
import type {
  ControllerSource,
  OpenAPI31Document,
  OpenAPIDocument,
  OpenAPIGeneratorOptions,
  OpenApiHandler,
  OpenApiRoute,
  RegisteredOpenApiRoute,
  RequestBodySchemaShorthand,
  RouteConfig,
} from "./types";

const DEFAULT_CONTENT_TYPE = "application/json";
const DEFAULT_SUCCESS_RESPONSE: RouteConfig["responses"] = {
  200: {
    description: "Success",
  },
};

export type OpenApiDocumentConfig = Parameters<OpenApiGeneratorV3["generateDocument"]>[0];
export type OpenApi31DocumentConfig = Parameters<OpenApiGeneratorV31["generateDocument"]>[0];
export type OpenApiDiscoveryMode = "auto" | "explicit";

/**
 * Sources used to assemble an OpenAPI registry from decorated controllers, wrapped handlers,
 * automatically discovered registrations, and manual routes.
 */
export interface CreateOpenApiRegistryOptions {
  controllers?: readonly ControllerSource[];
  discovery?: OpenApiDiscoveryMode;
  handlers?: readonly OpenApiHandler[];
  register?: (registry: OpenAPIRegistry) => void;
  routes?: readonly OpenApiRoute[];
}

/**
 * Input for generating an OpenAPI 3.0 document.
 */
export interface GenerateOpenApiDocumentOptions extends CreateOpenApiRegistryOptions {
  document: OpenApiDocumentConfig;
  generatorOptions?: OpenAPIGeneratorOptions;
}

/**
 * Input for generating an OpenAPI 3.1 document.
 */
export interface GenerateOpenApi31DocumentOptions extends CreateOpenApiRegistryOptions {
  document: OpenApi31DocumentConfig;
  generatorOptions?: OpenAPIGeneratorOptions;
}

function isZodSchema(value: unknown): value is z.ZodType {
  return (
    value instanceof z.ZodType || (typeof value === "object" && value !== null && "_zod" in value)
  );
}

function isRequestBodySchemaShorthand(value: unknown): value is RequestBodySchemaShorthand {
  return (
    typeof value === "object" &&
    value !== null &&
    "schema" in value &&
    isZodSchema((value as { schema: unknown }).schema)
  );
}

function normalizeRequestBody(route: OpenApiRoute): RouteConfig["request"] {
  if (!route.request) {
    return undefined;
  }

  const { body, ...request } = route.request;

  if (!body) {
    return request;
  }

  if (isZodSchema(body)) {
    return {
      ...request,
      body: {
        content: {
          [DEFAULT_CONTENT_TYPE]: {
            schema: body,
          },
        },
        required: true,
      },
    };
  }

  if (isRequestBodySchemaShorthand(body)) {
    return {
      ...request,
      body: {
        content: {
          [body.contentType ?? DEFAULT_CONTENT_TYPE]: {
            schema: body.schema,
          },
        },
        description: body.description,
        required: body.required ?? true,
      },
    };
  }

  return {
    ...request,
    body,
  };
}

function normalizeRoute(route: OpenApiRoute): RouteConfig {
  return {
    ...route,
    path: toOpenApiPath(route.path),
    request: normalizeRequestBody(route),
    responses: route.responses ?? DEFAULT_SUCCESS_RESPONSE,
  };
}

function getOperationKey(route: RouteConfig): string {
  return `${route.method.toUpperCase()} ${route.path}`;
}

function getRegisteredOperationKeys(registry: OpenAPIRegistry): Set<string> {
  return new Set(
    registry.definitions.flatMap((definition) =>
      definition.type === "route"
        ? [
            getOperationKey({
              ...definition.route,
              path: toOpenApiPath(definition.route.path),
            }),
          ]
        : [],
    ),
  );
}

function registerNormalizedRoute(
  registry: OpenAPIRegistry,
  route: OpenApiRoute,
  registeredOperations: Set<string>,
): void {
  const normalizedRoute = normalizeRoute(route);
  const operationKey = getOperationKey(normalizedRoute);

  if (registeredOperations.has(operationKey)) {
    throw new TypeError(`Duplicate OpenAPI operation: ${operationKey}`);
  }

  registeredOperations.add(operationKey);
  registry.registerPath(normalizedRoute);
}

function registerDecoratedRoute(
  registry: OpenAPIRegistry,
  registration: Pick<RegisteredOpenApiRoute, "handler" | "route">,
  registeredOperations: Set<string>,
  registeredHandlers: Map<OpenApiHandler, Set<string>>,
): void {
  const normalizedRoute = normalizeRoute(registration.route);
  const operationKey = getOperationKey(normalizedRoute);
  const handlerOperations = registeredHandlers.get(registration.handler) ?? new Set();

  if (handlerOperations.has(operationKey)) {
    return;
  }

  registerNormalizedRoute(registry, registration.route, registeredOperations);
  handlerOperations.add(operationKey);
  registeredHandlers.set(registration.handler, handlerOperations);
}

function registerNormalizedRoutes(
  registry: OpenAPIRegistry,
  routes: readonly OpenApiRoute[],
  controllers: readonly ControllerSource[],
  handlers: readonly OpenApiHandler[],
  discovery: OpenApiDiscoveryMode,
  register?: (registry: OpenAPIRegistry) => void,
): OpenAPIRegistry {
  const registeredOperations = getRegisteredOperationKeys(registry);
  const registeredHandlers = new Map<OpenApiHandler, Set<string>>();

  for (const route of routes) {
    registerNormalizedRoute(registry, route, registeredOperations);
  }

  for (const discoveredRoute of collectOpenApiRoutes(controllers)) {
    registerDecoratedRoute(registry, discoveredRoute, registeredOperations, registeredHandlers);
  }

  for (const handler of handlers) {
    const registrations = getHandlerOpenApiRoutes(handler);

    if (registrations.length === 0) {
      throw new TypeError(`Handler ${handler.name || "anonymous"} has no OpenAPI metadata.`);
    }

    for (const registration of registrations) {
      registerDecoratedRoute(registry, registration, registeredOperations, registeredHandlers);
    }
  }

  if (discovery === "auto") {
    for (const registration of getRegisteredOpenApiRoutes()) {
      registerDecoratedRoute(registry, registration, registeredOperations, registeredHandlers);
    }
  }

  register?.(registry);

  return registry;
}

/**
 * Registers manual routes and explicitly or automatically discovered routes into an existing registry.
 */
export function registerOpenApiRoutes(
  registry: OpenAPIRegistry,
  options: CreateOpenApiRegistryOptions = {},
): OpenAPIRegistry {
  return registerNormalizedRoutes(
    registry,
    options.routes ?? [],
    options.controllers ?? [],
    options.handlers ?? [],
    options.discovery ?? "explicit",
    options.register,
  );
}

/**
 * Creates a fresh registry populated from decorated sources, manual routes, and optional components.
 */
export function createOpenApiRegistry(options: CreateOpenApiRegistryOptions = {}): OpenAPIRegistry {
  return registerOpenApiRoutes(new OpenAPIRegistry(), options);
}

/**
 * Generates an OpenAPI 3.0 document from decorated sources and optional manual registry entries.
 */
export function generateOpenApiDocument(options: GenerateOpenApiDocumentOptions): OpenAPIDocument {
  const registry = createOpenApiRegistry(options);
  const generator = new OpenApiGeneratorV3(registry.definitions, options.generatorOptions);

  return generator.generateDocument(options.document);
}

/**
 * Generates an OpenAPI 3.1 document from decorated sources and optional manual registry entries.
 */
export function generateOpenApi31Document(
  options: GenerateOpenApi31DocumentOptions,
): OpenAPI31Document {
  const registry = createOpenApiRegistry(options);
  const generator = new OpenApiGeneratorV31(registry.definitions, options.generatorOptions);

  return generator.generateDocument(options.document);
}
