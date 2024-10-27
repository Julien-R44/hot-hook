import { readFile } from 'node:fs/promises'
import { parseImports } from 'parse-imports'
import { FileNotImportedDynamicallyException } from './file_not_imported_dynamically_exception.js'

/**
 * This class is responsible for checking if a given specifier
 * is imported dynamically from a given parent file.
 * Otherwise we will throw an error since we cannot make the file reloadable
 *
 * We are caching the results to avoid reading the same file multiple times
 */
export class DynamicImportChecker {
  private cache: Map<string, Map<string, boolean>> = new Map()
  private projectRoot: string

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot
  }

  async ensureFileIsImportedDynamicallyFromParent(parentPath: string, specifier: string) {
    const cacheKey = parentPath
    if (this.cache.has(cacheKey) && this.cache.get(cacheKey)!.has(specifier)) {
      return this.cache.get(cacheKey)!.get(specifier)
    }

    const parentCode = await readFile(parentPath, 'utf-8')
    const imports = [...(await parseImports(parentCode))]

    const isFileDynamicallyImportedFromParent = imports.some((importStatement) => {
      return importStatement.isDynamicImport && importStatement.moduleSpecifier.value === specifier
    })

    const currentCache = this.cache.get(cacheKey) ?? new Map()
    this.cache.set(cacheKey, currentCache.set(specifier, isFileDynamicallyImportedFromParent))

    if (!isFileDynamicallyImportedFromParent) {
      throw new FileNotImportedDynamicallyException(parentPath, specifier, this.projectRoot)
    }

    return isFileDynamicallyImportedFromParent
  }

  invalidateCache(key: string) {
    this.cache.delete(key)
  }
}
