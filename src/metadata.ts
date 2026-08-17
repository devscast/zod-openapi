import type {
  ControllerClass,
  ControllerSource,
  DecoratedRoute,
  OpenApiHandler,
  OpenApiRegistrationKind,
  OpenApiRoute,
  RegisteredOpenApiRoute,
} from "./types";

type DecoratedMethod = OpenApiHandler;

interface DecoratedRouteRegistration {
  kind: OpenApiRegistrationKind;
  metadata?: object;
  methodName: string | symbol;
  owner?: object;
  route: OpenApiRoute;
  static: boolean;
}

interface DecoratedRouteOrigin {
  kind?: OpenApiRegistrationKind;
  metadata?: object;
  owner?: object;
}

const decoratedHandlers = new Map<DecoratedMethod, DecoratedRouteRegistration[]>();
const decoratedMembers = new WeakMap<object, Map<string | symbol, DecoratedRouteRegistration>>();
const decoratedMetadata = new WeakMap<object, Map<string | symbol, DecoratedRouteRegistration[]>>();

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

function getDecoratorMetadata(source: object): object | undefined {
  const metadataSymbol = (Symbol as SymbolConstructor & { metadata?: symbol }).metadata;

  if (!metadataSymbol) {
    return undefined;
  }

  const metadata = (source as object & { [key: symbol]: unknown })[metadataSymbol];
  return typeof metadata === "object" && metadata !== null ? metadata : undefined;
}

function getRegistration(
  owner: object,
  metadataSource: object,
  propertyKey: string | symbol,
  handler: DecoratedMethod,
  isStatic: boolean,
): DecoratedRouteRegistration | undefined {
  const ownedRegistration = decoratedMembers.get(owner)?.get(propertyKey);

  if (ownedRegistration?.static === isStatic) {
    return ownedRegistration;
  }

  const metadata = getDecoratorMetadata(metadataSource);
  const metadataRegistration = metadata
    ? decoratedMetadata
        .get(metadata)
        ?.get(propertyKey)
        ?.find((registration) => registration.static === isStatic)
    : undefined;

  if (metadataRegistration?.static === isStatic) {
    return metadataRegistration;
  }

  return decoratedHandlers
    .get(handler)
    ?.find(
      (registration) =>
        !registration.metadata &&
        !registration.owner &&
        registration.kind === "method" &&
        registration.methodName === propertyKey &&
        registration.static === isStatic,
    );
}

function collectRoutesFromPrototype(
  controller: ControllerClass,
  prototype: object | null,
  discoveredRoutes: DecoratedRoute[],
  seenMembers: Set<string | symbol>,
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

      if (seenMembers.has(key)) {
        continue;
      }

      seenMembers.add(key);

      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || typeof descriptor.value !== "function") {
        continue;
      }

      const registration = getRegistration(
        current,
        current.constructor,
        key,
        descriptor.value,
        false,
      );

      if (!registration) {
        continue;
      }

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
  seenMembers: Set<string | symbol>,
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

      if (seenMembers.has(key)) {
        continue;
      }

      seenMembers.add(key);

      const descriptor = Object.getOwnPropertyDescriptor(current, key);
      if (!descriptor || typeof descriptor.value !== "function") {
        continue;
      }

      const registration = getRegistration(current, current, key, descriptor.value, true);

      if (!registration) {
        continue;
      }

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
  origin: DecoratedRouteOrigin = {},
): void {
  const registration = {
    kind: origin.kind ?? "method",
    metadata: origin.metadata,
    methodName,
    owner: origin.owner,
    route: cloneRoute(route),
    static: isStatic,
  };
  const handlerRegistrations = decoratedHandlers.get(handler) ?? [];
  const existingRegistrationIndex = handlerRegistrations.findIndex(
    (candidate) =>
      candidate.kind === registration.kind &&
      candidate.metadata === origin.metadata &&
      candidate.methodName === methodName &&
      candidate.owner === origin.owner &&
      candidate.static === isStatic,
  );

  if (existingRegistrationIndex === -1) {
    handlerRegistrations.push(registration);
  } else {
    handlerRegistrations[existingRegistrationIndex] = registration;
  }

  decoratedHandlers.set(handler, handlerRegistrations);

  if (origin.owner) {
    const memberRegistrations = decoratedMembers.get(origin.owner) ?? new Map();
    memberRegistrations.set(methodName, registration);
    decoratedMembers.set(origin.owner, memberRegistrations);
  }

  if (origin.metadata) {
    const metadataRegistrations =
      decoratedMetadata.get(origin.metadata) ??
      new Map<string | symbol, DecoratedRouteRegistration[]>();
    const memberRegistrations = metadataRegistrations.get(methodName) ?? [];
    const existingMemberIndex = memberRegistrations.findIndex(
      (candidate) => candidate.static === isStatic,
    );

    if (existingMemberIndex === -1) {
      memberRegistrations.push(registration);
    } else {
      memberRegistrations[existingMemberIndex] = registration;
    }

    metadataRegistrations.set(methodName, memberRegistrations);
    decoratedMetadata.set(origin.metadata, metadataRegistrations);
  }
}

export function hasOpenApiMetadata(handler: DecoratedMethod): boolean {
  return decoratedHandlers.has(handler);
}

function toRegisteredOpenApiRoute(
  handler: DecoratedMethod,
  registration: DecoratedRouteRegistration,
): RegisteredOpenApiRoute {
  return {
    handler,
    kind: registration.kind,
    name: registration.methodName,
    route: cloneRoute(registration.route),
    static: registration.static,
  };
}

/**
 * Returns every OpenAPI route attached to a specific handler.
 */
export function getHandlerOpenApiRoutes(handler: OpenApiHandler): RegisteredOpenApiRoute[] {
  return (decoratedHandlers.get(handler) ?? []).map((registration) =>
    toRegisteredOpenApiRoute(handler, registration),
  );
}

/**
 * Returns every route registered by imported decorators and wrapped functions.
 */
export function getRegisteredOpenApiRoutes(): RegisteredOpenApiRoute[] {
  return [...decoratedHandlers].flatMap(([handler, registrations]) =>
    registrations.map((registration) => toRegisteredOpenApiRoute(handler, registration)),
  );
}

/**
 * Discovers the decorated OpenAPI routes declared on a controller class or instance.
 */
export function getControllerOpenApiRoutes(source: ControllerSource): DecoratedRoute[] {
  const controller = resolveControllerClass(source);
  const discoveredRoutes: DecoratedRoute[] = [];

  collectRoutesFromPrototype(
    controller,
    getControllerPrototype(source),
    discoveredRoutes,
    new Set(),
  );
  collectRoutesFromConstructor(controller, discoveredRoutes, new Set());

  return discoveredRoutes;
}

/**
 * Collects the decorated OpenAPI routes from multiple controller classes or instances.
 */
export function collectOpenApiRoutes(sources: readonly ControllerSource[]): DecoratedRoute[] {
  return sources.flatMap((source) => getControllerOpenApiRoutes(source));
}
