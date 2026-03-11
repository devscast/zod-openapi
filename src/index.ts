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
export { openapi } from "./decorator";
export {
  createOpenApiRegistry,
  generateOpenApi31Document,
  generateOpenApiDocument,
  registerOpenApiRoutes,
} from "./document";
export {
  collectOpenApiRoutes,
  getControllerOpenApiRoutes,
  hasOpenApiMetadata,
} from "./metadata";
export type * from "./types";
