import chokidar from 'chokidar'
import { realpath } from 'node:fs/promises'
import { MessagePort } from 'node:worker_threads'
import { fileURLToPath } from 'node:url'
import { resolve as pathResolve, dirname } from 'node:path'
import type { InitializeHook, LoadHook, ResolveHook } from 'node:module'

import debug from './debug.js'
import { Matcher } from './matcher.js'
import DependencyTree from './dependency_tree.js'
import { InitializeHookOptions } from './types.js'

export class HotHookLoader {
  #projectRoot: string
  #messagePort?: MessagePort
  #watcher: chokidar.FSWatcher
  #pathIgnoredMatcher: Matcher
  #dependencyTree: DependencyTree
  #hardcodedBoundaryMatcher: Matcher

  constructor(options: InitializeHookOptions) {
    this.#projectRoot = dirname(options.root)
    this.#messagePort = options.messagePort

    this.#watcher = this.#createWatcher().add(options.root)
    this.#pathIgnoredMatcher = new Matcher(this.#projectRoot, options.ignore)
    this.#hardcodedBoundaryMatcher = new Matcher(this.#projectRoot, options.boundaries)

    this.#dependencyTree = new DependencyTree({ root: options.root })
    this.#messagePort?.on('message', (message) => this.#onMessage(message))
  }

  /**
   * When a message is received from the main thread
   */
  #onMessage(message: any) {
    if (message.type !== 'hot-hook:dump') return 

    const dump = this.#dependencyTree.dump()
    this.#messagePort?.postMessage({ type: 'hot-hook:dump', dump })
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
    };

    import.meta.hot.dump = async () => {
      const { hot } = await import('hot-hook');
      return hot.dump();
    };

    import.meta.hot.boundary = { with: { hot: 'true' } };
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
    if (resultUrl.protocol !== 'file:') {
      return result
    }

    const resultPath = fileURLToPath(resultUrl)
    const parentPath = fileURLToPath(parentUrl)

    const isHardcodedBoundary = this.#hardcodedBoundaryMatcher.match(resultPath)
    const reloadable = context.importAttributes.hot === 'true' ? true : isHardcodedBoundary

    this.#dependencyTree.addDependency(parentPath, { path: resultPath, reloadable })
    this.#dependencyTree.addDependent(resultPath, parentPath)

    if (this.#pathIgnoredMatcher.match(resultPath)) {
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
