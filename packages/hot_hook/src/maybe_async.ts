/**
 * Applies `fn` to `value`, or to its resolved value when it is a promise.
 *
 * This lets the same hooks run synchronously with `module.registerHooks()`,
 * where `nextResolve`/`nextLoad` return plain objects, and asynchronously with
 * the `module.register()` fallback, where they return promises.
 */
export function then<T, R>(value: T | Promise<T>, fn: (value: T) => R): R | Promise<R> {
  return value instanceof Promise ? value.then(fn) : fn(value)
}
