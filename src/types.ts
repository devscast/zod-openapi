import type {
  OpenApiGeneratorV3,
  ResponseConfig,
  ZodContentObject,
  ZodMediaTypeObject,
  ZodRequestBody,
  RouteConfig as ZodToOpenApiRouteConfig,
} from "@asteasolutions/zod-to-openapi";
import type { OpenAPIObject as OpenAPIV3Document } from "openapi3-ts/oas30";
import type { OpenAPIObject as OpenAPIV31Document } from "openapi3-ts/oas31";
import type { ZodType } from "zod";

export type RouteConfig = ZodToOpenApiRouteConfig;
export type HttpMethod = RouteConfig["method"];
export type ZodSchema = ZodType<unknown>;

export type { ResponseConfig, ZodContentObject, ZodMediaTypeObject, ZodRequestBody };

/**
 * Shorthand request body config for the common JSON case.
 */
export interface RequestBodySchemaShorthand {
  contentType?: string;
  description?: string;
  required?: boolean;
  schema: ZodSchema;
}

export type RequestConfig = Omit<NonNullable<RouteConfig["request"]>, "body"> & {
  body?: RequestBodySchemaShorthand | ZodRequestBody | ZodSchema;
};

/**
 * Route metadata accepted by the decorator and the document generators.
 */
export type OpenApiRoute = Omit<RouteConfig, "path" | "request" | "responses"> & {
  path: string;
  request?: RequestConfig;
  responses?: RouteConfig["responses"];
};

export type OpenAPIDocument = OpenAPIV3Document;
export type OpenAPI31Document = OpenAPIV31Document;
export type OpenAPIGeneratorOptions = ConstructorParameters<typeof OpenApiGeneratorV3>[1];

export type ControllerClass<T = object> = abstract new (...args: any[]) => T;
export type ControllerSource<T = object> = ControllerClass<T> | T;

/**
 * Decorated route metadata discovered from a controller class or instance.
 */
export interface DecoratedRoute {
  controller: ControllerClass;
  controllerName: string;
  handler: (...args: any[]) => unknown;
  methodName: string | symbol;
  route: OpenApiRoute;
  static: boolean;
}
