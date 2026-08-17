import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
export { z } from "zod";

export { createRoute, toOpenApiPath, toRoutingPath } from "./create-route";
export type {
  OpenApiDecorator,
  OpenApiFunctionDecorator,
  OpenApiMethodDecorator,
} from "./decorator";
export { openapi } from "./decorator";
export type {
  CreateOpenApiRegistryOptions,
  GenerateOpenApi31DocumentOptions,
  GenerateOpenApiDocumentOptions,
  OpenApi31DocumentConfig,
  OpenApiDiscoveryMode,
  OpenApiDocumentConfig,
} from "./document";
export {
  createOpenApiRegistry,
  generateOpenApi31Document,
  generateOpenApiDocument,
  registerOpenApiRoutes,
} from "./document";
export {
  collectOpenApiRoutes,
  getControllerOpenApiRoutes,
  getHandlerOpenApiRoutes,
  getRegisteredOpenApiRoutes,
  hasOpenApiMetadata,
} from "./metadata";
export type * from "./types";
