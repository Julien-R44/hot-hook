import fg from 'fast-glob'
import chokidar from 'chokidar'
import picomatch from 'picomatch'
import { realpath } from 'node:fs/promises'
import { MessagePort } from 'node:worker_threads'
import { relative, resolve as pathResolve, dirname } from 'node:path'
import type { InitializeHook, LoadHook, ResolveHook } from 'node:module'

import debug from './debug.js'
import DependencyTree from './dependency_tree.js'
import { InitializeHookOptions } from './types.js'

export class HotHookLoader {
  #projectRoot: string
  #messagePort?: MessagePort
  #watcher: chokidar.FSWatcher
  #dependencyTree = new DependencyTree()
  #isPathIgnoredMatcher: picomatch.Matcher

  constructor(options: InitializeHookOptions) {
    this.#projectRoot = dirname(options.root)
    this.#messagePort = options.messagePort

    this.#watcher = this.#createWatcher(options.reload)
    this.#isPathIgnoredMatcher = picomatch(options.ignore || [], {
      dot: true,
    })

    this.#dependencyTree.add(options.root)
    this.#watcher.add(options.root)
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
   * When a file changes, invalidate it and its dependents.
   */
  async #onFileChange(relativeFilePath: string) {
    const filePath = pathResolve(relativeFilePath)
    const realFilePath = await realpath(filePath)

    /**
     * If the file is in the reload list, we send a full reload message
     * to the main thread.
     */
    const isReloadable = this.#dependencyTree.isReloadable(realFilePath)
    if (!isReloadable) {
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
  #createWatcher(initialPaths: picomatch.Glob = []) {
    const arrayPaths = Array.isArray(initialPaths) ? initialPaths : [initialPaths]
    const entries = fg.sync(arrayPaths, { cwd: this.#projectRoot, absolute: true })

    const watcher = chokidar.watch(entries)

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
    };

    import.meta.hot.boundary = () => {
      return { with: { hot: 'true' } };
    };
    `

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

    if (context.importAttributes.hot) {
      delete context.importAttributes.hot
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
    if (resultUrl.protocol !== 'file:') {
      return result
    }

    const reloadable = context.importAttributes.hot === 'true' ? true : false
    this.#dependencyTree.addDependency(parentUrl?.pathname, { path: resultPath, reloadable })
    this.#dependencyTree.addDependent(resultPath, parentUrl?.pathname)

    if (this.#isPathIgnored(resultPath)) {
      return result
    }

    this.#watcher.add(resultPath)
    const version = this.#dependencyTree.getVersion(resultPath).toString()
    resultUrl.searchParams.set('hot-hook', version)

    return { ...result, url: resultUrl.href }
  }
}

let loader!: HotHookLoader
export const initialize: InitializeHook = async (data: InitializeHookOptions) => {
  loader = new HotHookLoader(data)
}
export const load: LoadHook = (...args) => loader?.load(...args)
export const resolve: ResolveHook = (...args) => loader?.resolve(...args)
