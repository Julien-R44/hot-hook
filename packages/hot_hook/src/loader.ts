import path from 'node:path'
import { URL } from 'node:url'
import chokidar from 'chokidar'
import { realpath } from 'node:fs/promises'
import type { InitializeHook, LoadHook, ResolveHook } from 'node:module'

import debug from './debug.js'
import DependencyTree from './dependency_tree.js'
import type { InitializeHookOptions } from './types.js'

const dependencyTree = new DependencyTree()

let options: InitializeHookOptions

/**
 * Check if a path should be ignored and not watched.
 */
function isPathIgnored(filePath: string) {
  return options.ignore?.some((pattern) => filePath.includes(pattern)) ?? false
}

/**
 * Check if a path should trigger a full reload.
 */
function isReloadPath(filePath: string) {
  if (typeof options.reload === 'function') {
    return options.reload(filePath)
  }

  return options.reload?.some((pattern) => filePath.includes(pattern)) ?? false
}

const watcher = chokidar
  .watch([])
  .on('change', async (relativeFilePath) => {
    const filePath = path.resolve(relativeFilePath)
    const realFilePath = await realpath(filePath)

    debug('Changed %s', realFilePath)
    if (isReloadPath(realFilePath)) {
      options.messagePort?.postMessage({ type: 'hot-hook:full-reload' })
      return
    }

    const invalidatedFiles = dependencyTree.invalidateFileAndDependents(realFilePath)
    debug('Invalidating %s', Array.from(invalidatedFiles).join(', '))
    options.messagePort?.postMessage({
      type: 'hot-hook:invalidated',
      paths: Array.from(invalidatedFiles),
    })
  })
  .on('unlink', (relativeFilePath) => {
    const filePath = path.resolve(relativeFilePath)
    debug('Deleted %s', filePath)
    dependencyTree.remove(filePath)
  })

/**
 * Load hook
 */
export const load: LoadHook = async (url, context, nextLoad) => {
  const parsedUrl = new URL(url)
  if (parsedUrl.searchParams.has('hot-hook')) {
    parsedUrl.searchParams.delete('hot-hook')
    url = parsedUrl.href
  }

  if (parsedUrl.protocol === 'file:') {
    debug('Importing %s', parsedUrl.pathname)
  }

  const result = await nextLoad(url, context)

  if (result.format === 'module') {
    const hotFns = `
      import.meta.hot = {}

      import.meta.hot.dispose = (callback) => {
        const { hot } = await import('hot-hook)
        hot.dispose(import.meta.url, callback)
      };

      import.meta.hot.decline = () => {
        const { hot } = await import('hot-hook)
        hot.decline(import.meta.url)
      }
    `

    result.source = hotFns + result.source
  }

  return result
}

/**
 * Resolve hook
 */
export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  const parentUrl = (context.parentURL && new URL(context.parentURL)) as URL
  if (parentUrl?.searchParams.has('hot-hook')) {
    parentUrl.searchParams.delete('hot-hook')
    context = { ...context, parentURL: parentUrl.href }
  }

  const result = await nextResolve(specifier, context)

  const resultUrl = new URL(result.url)
  const resultPath = resultUrl.pathname
  if (resultUrl.protocol !== 'file:' || isPathIgnored(resultPath)) {
    return result
  }

  if (!dependencyTree.has(resultPath)) {
    debug('Watching %s', resultPath)
    dependencyTree.add(resultPath)
    watcher.add(resultPath)
  }

  const parentPath = parentUrl?.pathname
  if (parentPath) {
    dependencyTree.addDependent(resultPath, parentPath)
  }

  resultUrl.searchParams.set('hot-hook', dependencyTree.getVersion(resultPath)!.toString())
  return { ...result, url: resultUrl.href }
}

/**
 * Initialize hook
 */
export const initialize: InitializeHook = (data: InitializeHookOptions) => {
  options = data
}
