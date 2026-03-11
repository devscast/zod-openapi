import { registerDecoratedRoute } from "./metadata";
import type { OpenApiRoute } from "./types";

type DecoratedMethod = (...args: any[]) => unknown;

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
 * Attaches OpenAPI metadata to a controller method without coupling route registration
 * to the framework runtime.
 */
export function openapi(route: OpenApiRoute): OpenApiMethodDecorator {
  return ((...args: unknown[]) => {
    if (isStandardDecoratorInvocation(args)) {
      const [value, context] = args;

      if (context.kind !== "method") {
        throw new TypeError("@openapi can only decorate class methods.");
      }

      if (context.private) {
        throw new TypeError("@openapi cannot decorate private methods.");
      }

      registerDecoratedRoute(value, context.name, route, Boolean(context.static));
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

    registerDecoratedRoute(descriptor.value, propertyKey, route, typeof target === "function");
    return descriptor;
  }) as OpenApiMethodDecorator;
}
