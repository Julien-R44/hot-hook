import { readFileSync } from 'node:fs'
import { parseImportsSync, wasmLoadPromise } from 'parse-imports'

/**
 * `parseImportsSync` needs the lexer WASM to be loaded. The check runs inside
 * module hooks, which are synchronous with `module.registerHooks()`.
 */
await wasmLoadPromise

/**
 * This class is responsible for checking if a given specifier
 * is imported dynamically from a given parent file.
 * Otherwise we will throw an error since we cannot make the file reloadable
 *
 * We are caching the results to avoid reading the same file multiple times
 *
 * When no import is found for the given specifier we assume that it is imported using a dynamic specifier.
 */
export class DynamicImportChecker {
  private cache: Map<string, Map<string, boolean>> = new Map()

  ensureFileIsImportedDynamicallyFromParent(parentPath: string, specifier: string) {
    const cacheKey = parentPath
    if (this.cache.has(cacheKey) && this.cache.get(cacheKey)!.has(specifier)) {
      return this.cache.get(cacheKey)!.get(specifier)!
    }

    const parentCode = readFileSync(parentPath, 'utf-8')
    const imports = [...parseImportsSync(parentCode)]

    const matchingImport = imports.find((importStatement) => {
      return importStatement.moduleSpecifier.value === specifier
    })

    const isFileDynamicallyImportedFromParent = matchingImport
      ? matchingImport.isDynamicImport
      : true

    const currentCache = this.cache.get(cacheKey) ?? new Map()
    this.cache.set(cacheKey, currentCache.set(specifier, isFileDynamicallyImportedFromParent))

    return isFileDynamicallyImportedFromParent
  }

  invalidateCache(key: string) {
    this.cache.delete(key)
  }
}
