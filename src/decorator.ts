import { registerDecoratedRoute } from "./metadata";
import type { OpenApiHandler, OpenApiRoute } from "./types";

type DecoratedMethod = OpenApiHandler;

type LegacyMethodDecorator = <Method extends DecoratedMethod>(
  target: object,
  propertyKey: string | symbol,
  descriptor: TypedPropertyDescriptor<Method>,
) => TypedPropertyDescriptor<Method> | undefined;

type StandardMethodDecorator = <Method extends DecoratedMethod>(
  value: Method,
  context: ClassMethodDecoratorContext<object, Method>,
) => Method | undefined;

export type OpenApiMethodDecorator = LegacyMethodDecorator & StandardMethodDecorator;

export type OpenApiFunctionDecorator = <Handler extends OpenApiHandler>(
  handler: Handler,
) => Handler;

export type OpenApiDecorator = OpenApiMethodDecorator & OpenApiFunctionDecorator;

function isStandardDecoratorInvocation(
  args: unknown[],
): args is [DecoratedMethod, ClassMethodDecoratorContext<object, DecoratedMethod>] {
  return (
    args.length === 2 &&
    typeof args[0] === "function" &&
    typeof args[1] === "object" &&
    args[1] !== null &&
    "kind" in args[1]
  );
}

/**
 * Attaches OpenAPI metadata to a controller method or standalone function without
 * coupling route registration to the framework runtime.
 */
export function openapi(route: OpenApiRoute): OpenApiDecorator {
  return ((...args: unknown[]) => {
    if (args.length === 1 && typeof args[0] === "function") {
      const [handler] = args as [OpenApiHandler];
      registerDecoratedRoute(handler, handler.name || "anonymous", route, false, {
        kind: "function",
      });
      return handler;
    }

    if (isStandardDecoratorInvocation(args)) {
      const [value, context] = args;

      if (context.kind !== "method") {
        throw new TypeError("@openapi can only decorate class methods.");
      }

      if (context.private) {
        throw new TypeError("@openapi cannot decorate private methods.");
      }

      registerDecoratedRoute(value, context.name, route, Boolean(context.static), {
        kind: "method",
        metadata: context.metadata,
      });
      return value;
    }

    const [target, propertyKey, descriptor] = args as [
      object,
      string | symbol,
      TypedPropertyDescriptor<DecoratedMethod> | undefined,
    ];

    if (!descriptor || typeof descriptor.value !== "function") {
      throw new TypeError("@openapi can only decorate class methods.");
    }

    registerDecoratedRoute(descriptor.value, propertyKey, route, typeof target === "function", {
      kind: "method",
      owner: target,
    });
    return descriptor;
  }) as OpenApiDecorator;
}
