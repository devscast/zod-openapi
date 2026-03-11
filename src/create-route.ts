import type { OpenApiRoute } from "./types";

export type RoutingPath<Path extends string> =
  Path extends `${infer Start}/{${infer Param}}${infer Rest}`
    ? `${Start}/:${Param}${RoutingPath<Rest>}`
    : Path;

export type OpenApiPath<Path extends string> =
  Path extends `${infer Start}/:${infer Param}/${infer Rest}`
    ? `${Start}/{${Param}}/${OpenApiPath<Rest>}`
    : Path extends `${infer Start}/:${infer Param}`
      ? `${Start}/{${Param}}`
      : Path;

type RouteWithPath<Path extends string> = Omit<OpenApiRoute, "path"> & {
  path: Path;
};

export type CreatedRoute<Route extends RouteWithPath<string>> = Route & {
  getOpenApiPath(): OpenApiPath<Route["path"]>;
  getRoutingPath(): RoutingPath<Route["path"]>;
};

const OPENAPI_PATH_PARAMETER_PATTERN = /\/{([^}/]+)}/g;
const ROUTING_PATH_PARAMETER_PATTERN = /(^|\/):([A-Za-z0-9_]+)(?=\/|$)/g;

/**
 * Converts an OpenAPI path such as `/users/{id}` into a routing path such as `/users/:id`.
 */
export function toRoutingPath<Path extends string>(path: Path): RoutingPath<Path> {
  return path.replaceAll(OPENAPI_PATH_PARAMETER_PATTERN, "/:$1") as RoutingPath<Path>;
}

/**
 * Converts a routing path such as `/users/:id` into an OpenAPI path such as `/users/{id}`.
 */
export function toOpenApiPath<Path extends string>(path: Path): OpenApiPath<Path> {
  return path.replaceAll(ROUTING_PATH_PARAMETER_PATTERN, "$1{$2}") as OpenApiPath<Path>;
}

/**
 * Optional helper for authoring reusable route definitions while keeping path conversion helpers nearby.
 */
export function createRoute<const Route extends RouteWithPath<string>>(
  route: Route,
): CreatedRoute<Route> {
  const createdRoute = {
    ...route,
    getOpenApiPath() {
      return toOpenApiPath(route.path) as OpenApiPath<Route["path"]>;
    },
    getRoutingPath() {
      return toRoutingPath(route.path) as RoutingPath<Route["path"]>;
    },
  };

  Object.defineProperty(createdRoute, "getOpenApiPath", { enumerable: false });
  Object.defineProperty(createdRoute, "getRoutingPath", { enumerable: false });

  return createdRoute;
}
