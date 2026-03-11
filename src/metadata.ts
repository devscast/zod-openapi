import type { ControllerClass, ControllerSource, DecoratedRoute, OpenApiRoute } from "./types";

type DecoratedMethod = (...args: any[]) => unknown;

interface DecoratedRouteRegistration {
  methodName: string | symbol;
  route: OpenApiRoute;
  static: boolean;
}

const decoratedRoutes = new WeakMap<DecoratedMethod, DecoratedRouteRegistration>();

function cloneRoute(route: OpenApiRoute): OpenApiRoute {
  return {
    ...route,
    request: route.request ? { ...route.request } : undefined,
    responses: route.responses ? { ...route.responses } : undefined,
    security: route.security?.map((scheme) => ({ ...scheme })),
    servers: route.servers?.map((server) => ({ ...server })),
    tags: route.tags ? [...route.tags] : undefined,
  };
}

function isPrototypeInspectable(prototype: object | null): prototype is Exclude<object, null> {
  return prototype !== null && prototype !== Object.prototype;
}

function isConstructorInspectable(candidate: unknown): candidate is ControllerClass {
  return typeof candidate === "function" && candidate !== Function.prototype;
}

function resolveControllerClass(source: ControllerSource): ControllerClass {
  return typeof source === "function"
    ? (source as ControllerClass)
    : (source.constructor as ControllerClass);
}

function getControllerPrototype(source: ControllerSource): object | null {
  return typeof source === "function" ? source.prototype : Object.getPrototypeOf(source);
}

function resolveControllerName(controller: ControllerClass): string {
  return controller.name || "AnonymousController";
}

function collectRoutesFromPrototype(
  controller: ControllerClass,
  prototype: object | null,
  discoveredRoutes: DecoratedRoute[],
  seenHandlers: Set<DecoratedMethod>,
): void {
  for (
    let current = prototype;
    isPrototypeInspectable(current);
    current = Object.getPrototypeOf(current)
  ) {
    for (const key of Reflect.ownKeys(current)) {
      if (key === "constructor") {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || typeof descriptor.value !== "function") {
        continue;
      }

      const registration = decoratedRoutes.get(descriptor.value);

      if (!registration || registration.static || seenHandlers.has(descriptor.value)) {
        continue;
      }

      seenHandlers.add(descriptor.value);
      discoveredRoutes.push({
        controller,
        controllerName: resolveControllerName(controller),
        handler: descriptor.value,
        methodName: registration.methodName,
        route: cloneRoute(registration.route),
        static: false,
      });
    }
  }
}

function collectRoutesFromConstructor(
  controller: ControllerClass,
  discoveredRoutes: DecoratedRoute[],
  seenHandlers: Set<DecoratedMethod>,
): void {
  for (
    let current: unknown = controller;
    isConstructorInspectable(current);
    current = Object.getPrototypeOf(current)
  ) {
    for (const key of Reflect.ownKeys(current)) {
      if (key === "length" || key === "name" || key === "prototype") {
        continue;
      }

      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || typeof descriptor.value !== "function") {
        continue;
      }

      const registration = decoratedRoutes.get(descriptor.value);

      if (!registration || !registration.static || seenHandlers.has(descriptor.value)) {
        continue;
      }

      seenHandlers.add(descriptor.value);
      discoveredRoutes.push({
        controller,
        controllerName: resolveControllerName(controller),
        handler: descriptor.value,
        methodName: registration.methodName,
        route: cloneRoute(registration.route),
        static: true,
      });
    }
  }
}

export function registerDecoratedRoute(
  handler: DecoratedMethod,
  methodName: string | symbol,
  route: OpenApiRoute,
  isStatic = false,
): void {
  decoratedRoutes.set(handler, {
    methodName,
    route: cloneRoute(route),
    static: isStatic,
  });
}

export function hasOpenApiMetadata(handler: DecoratedMethod): boolean {
  return decoratedRoutes.has(handler);
}

/**
 * Discovers the decorated OpenAPI routes declared on a controller class or instance.
 */
export function getControllerOpenApiRoutes(source: ControllerSource): DecoratedRoute[] {
  const controller = resolveControllerClass(source);
  const discoveredRoutes: DecoratedRoute[] = [];
  const seenHandlers = new Set<DecoratedMethod>();

  collectRoutesFromPrototype(
    controller,
    getControllerPrototype(source),
    discoveredRoutes,
    seenHandlers,
  );
  collectRoutesFromConstructor(controller, discoveredRoutes, seenHandlers);

  return discoveredRoutes;
}

/**
 * Collects the decorated OpenAPI routes from multiple controller classes or instances.
 */
export function collectOpenApiRoutes(sources: readonly ControllerSource[]): DecoratedRoute[] {
  return sources.flatMap((source) => getControllerOpenApiRoutes(source));
}
