import chokidar from 'chokidar'
import picomatch from 'picomatch'
import { realpath } from 'node:fs/promises'
import { relative, resolve as pathResolve } from 'node:path'
import { MessagePort } from 'node:worker_threads'
import type { InitializeHook, LoadHook, ResolveHook } from 'node:module'

import debug from './debug.js'
import DependencyTree from './dependency_tree.js'
import { InitializeHookOptions } from './types.js'

export class HotHookLoader {
  #projectRoot: string
  #messagePort?: MessagePort
  #watcher: chokidar.FSWatcher
  #dependencyTree = new DependencyTree()
  #isReloadPathMatcher: picomatch.Matcher
  #isPathIgnoredMatcher: picomatch.Matcher

  constructor(options: InitializeHookOptions) {
    this.#projectRoot = options.projectRoot
    this.#messagePort = options.messagePort

    this.#watcher = this.#createWatcher()
    this.#isReloadPathMatcher = picomatch(options.reload || [])
    this.#isPathIgnoredMatcher = picomatch(options.ignore || [])
  }

  #buildRelativePath(filePath: string) {
    return relative(this.#projectRoot, filePath)
  }

  /**
   * Check if a path should be ignored and not watched.
   */
  #isPathIgnored(filePath: string) {
    return this.#isPathIgnoredMatcher(this.#buildRelativePath(filePath))
  }

  /**
   * Check if a path should trigger a full reload.
   */
  #isReloadPath(filePath: string) {
    return this.#isReloadPathMatcher(this.#buildRelativePath(filePath))
  }

  /**
   * When a file changes, invalidate it and its dependents.
   */
  async #onFileChange(relativeFilePath: string) {
    const filePath = pathResolve(relativeFilePath)
    const realFilePath = await realpath(filePath)

    /**
     * If the file is in the reload list, we send a full reload message
     * to the main thread.
     */
    debug('Changed %s', realFilePath)
    if (this.#isReloadPath(realFilePath)) {
      return this.#messagePort?.postMessage({ type: 'hot-hook:full-reload', path: realFilePath })
    }

    /**
     * Otherwise, we invalidate the file and its dependents
     */
    const invalidatedFiles = this.#dependencyTree.invalidateFileAndDependents(realFilePath)
    debug('Invalidating %s', Array.from(invalidatedFiles).join(', '))
    this.#messagePort?.postMessage({ type: 'hot-hook:invalidated', paths: [...invalidatedFiles] })
  }

  /**
   * Create the chokidar watcher instance.
   */
  #createWatcher() {
    const watcher = chokidar.watch([])

    watcher.on('change', this.#onFileChange.bind(this))
    watcher.on('unlink', (relativeFilePath) => {
      const filePath = pathResolve(relativeFilePath)
      debug('Deleted %s', filePath)
      this.#dependencyTree.remove(filePath)
    })

    return watcher
  }

  /**
   * Returns the code source for the import.meta.hot object.
   * We need to add this to every module since `import.meta.hot` is
   * scoped to each module.
   */
  #getImportMetaHotSource() {
    let hotFns = `
    import.meta.hot = {};
    import.meta.hot.dispose = async (callback) => {
      const { hot } = await import('hot-hook');
      hot.dispose(import.meta.url, callback);
    };

    import.meta.hot.decline = async () => {
      const { hot } = await import('hot-hook');
      hot.decline(import.meta.url);
    };`

    /**
     * By minifying the code we can avoid adding a new line to the source
     * and so we can avoid totally breaking the source maps.
     *
     * This simple trick seems to do the job for now, but we should probably
     * find a better way to handle this in the future.
     */
    return hotFns.replace(/\n/g, '').replace(/\s{2,}/g, ' ')
  }

  /**
   * The load hook.
   * We use it mainly for adding the import.meta.hot object to the module.
   */
  load: LoadHook = async (url, context, nextLoad) => {
    const parsedUrl = new URL(url)
    if (parsedUrl.searchParams.has('hot-hook')) {
      parsedUrl.searchParams.delete('hot-hook')
      url = parsedUrl.href
    }

    const result = await nextLoad(url, context)
    if (result.format !== 'module') return result

    result.source = this.#getImportMetaHotSource() + result.source
    return result
  }

  /**
   * The resolve hook
   * We use it for :
   * - Adding the hot-hook query parameter to the URL ( to getting a fresh version )
   * - And adding files to the watcher
   */
  resolve: ResolveHook = async (specifier, context, nextResolve) => {
    const parentUrl = (context.parentURL && new URL(context.parentURL)) as URL
    if (parentUrl?.searchParams.has('hot-hook')) {
      parentUrl.searchParams.delete('hot-hook')
      context = { ...context, parentURL: parentUrl.href }
    }

    const result = await nextResolve(specifier, context)

    const resultUrl = new URL(result.url)
    const resultPath = resultUrl.pathname
    if (resultUrl.protocol !== 'file:' || this.#isPathIgnored(resultPath)) {
      return result
    }

    if (!this.#dependencyTree.has(resultPath)) {
      debug('Watching %s', resultPath)
      this.#dependencyTree.add(resultPath)
      this.#watcher.add(resultPath)
    }

    const parentPath = parentUrl?.pathname
    if (parentPath) {
      this.#dependencyTree.addDependent(resultPath, parentPath)
    }

    resultUrl.searchParams.set('hot-hook', this.#dependencyTree.getVersion(resultPath)!.toString())
    return { ...result, url: resultUrl.href }
  }
}

let loader!: HotHookLoader
export const initialize: InitializeHook = (data: InitializeHookOptions) => {
  loader = new HotHookLoader(data)
}
export const load: LoadHook = (...args) => loader?.load(...args)
export const resolve: ResolveHook = (...args) => loader?.resolve(...args)
