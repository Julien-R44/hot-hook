import { fileURLToPath } from 'node:url'
import chokidar, { type FSWatcher } from 'chokidar'
import { access, realpath } from 'node:fs/promises'
import type { MessagePort } from 'node:worker_threads'
import { resolve as pathResolve, dirname } from 'node:path'
import type { InitializeHook, LoadHook, ResolveHook } from 'node:module'

import debug from './debug.js'
import { Matcher } from './matcher.js'
import DependencyTree from './dependency_tree.js'
import type { InitializeHookOptions } from './types.js'
import { DynamicImportChecker } from './dynamic_import_checker.js'
import { FileNotImportedDynamicallyException } from './errors/file_not_imported_dynamically_exception.js'

export class HotHookLoader {
  #options: InitializeHookOptions
  #projectRoot!: string
  #reloadMatcher!: Matcher
  #messagePort?: MessagePort
  #watcher?: FSWatcher
  #pathIgnoredMatcher!: Matcher
  #dependencyTree: DependencyTree
  #hardcodedBoundaryMatcher!: Matcher
  #dynamicImportChecker!: DynamicImportChecker
  #boundFileChangeHandler = this.#onFileChange.bind(this)

  constructor(options: InitializeHookOptions) {
    this.#options = options
    this.#messagePort = options.messagePort
    this.#projectRoot = options.rootDirectory!

    if (options.root) this.#initialize(options.root)

    this.#dependencyTree = new DependencyTree({ root: options.root })
    this.#dynamicImportChecker = new DynamicImportChecker()
    this.#messagePort?.on('message', (message) => this.#onMessage(message))
  }

  /**
   * Initialize the class with the provided root path.
   */
  #initialize(root: string) {
    this.#projectRoot = this.#projectRoot ?? dirname(root)
    this.#reloadMatcher = new Matcher(this.#projectRoot, this.#options.restart || [])
    this.#pathIgnoredMatcher = new Matcher(this.#projectRoot, this.#options.ignore)
    this.#hardcodedBoundaryMatcher = new Matcher(this.#projectRoot, this.#options.boundaries)

    if (this.#options.watch !== false) {
      this.#cleanupWatcher()
      this.#watcher = this.#createWatcher().add([root, ...(this.#options.restart || [])])
    }
  }

  /**
   * Clean up the existing watcher and its event listeners
   */
  #cleanupWatcher() {
    if (!this.#watcher) return

    this.#watcher.off('change', this.#boundFileChangeHandler)
    this.#watcher.off('unlink', this.#boundFileChangeHandler)
    this.#watcher.close()
    this.#watcher = undefined
  }

  /**
   * Check if a file exists
   */
  async #checkIfFileExists(filePath: string) {
    try {
      await access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * When a message is received from the main thread
   */
  #onMessage(message: any) {
    if (message.type === 'hot-hook:dump') {
      const dump = this.#dependencyTree.dump()
      this.#messagePort?.postMessage({ type: 'hot-hook:dump', dump })
      return
    }

    if (message.type === 'hot-hook:file-changed') {
      this.#onFileChange(message.path)
    }
  }

  /**
   * When a file changes, invalidate it and its dependents.
   */
  async #onFileChange(relativeFilePath: string) {
    debug('File change %s', relativeFilePath)

    const filePath = pathResolve(relativeFilePath)
    const realFilePath = await realpath(filePath).catch(() => null)

    /**
     * Realpath throws an error when the file does not exist.
     */
    if (!realFilePath) {
      debug('Could not resolve realFilePath %s', filePath)
      return this.#dependencyTree.remove(filePath)
    }

    /**
     * First check if file still exists. If not, we must remove it from the
     * dependency tree
     */
    const isFileExist = await this.#checkIfFileExists(realFilePath)
    if (!isFileExist) {
      debug('File does not exist anymore %s', realFilePath)
      return this.#dependencyTree.remove(realFilePath)
    }

    /**
     * Invalidate the dynamic import cache for the file since we
     * gonna need to recheck the dynamic imports.
     */
    this.#dynamicImportChecker.invalidateCache(filePath)

    /**
     * If the file is an hardcoded reload file, we trigger a full reload.
     */
    if (this.#reloadMatcher.match(realFilePath)) {
      debug('Full reload (hardcoded `restart` file) %s', realFilePath)
      return this.#messagePort?.postMessage({ type: 'hot-hook:full-reload', path: realFilePath })
    }

    /**
     * If the file is not in the dependency tree, it means it hasn't been
     * imported yet. We skip processing it.
     */
    if (!this.#dependencyTree.isInside(realFilePath)) {
      debug('File not in dependency tree, skipping %s', realFilePath)
      return
    }

    /**
     * If the file is not reloadable according to the dependency tree,
     * we trigger a full reload.
     */
    const { reloadable, shouldBeReloadable } = this.#dependencyTree.isReloadable(realFilePath)
    if (!reloadable) {
      debug('Full reload (not-reloadable file) %s', realFilePath)
      return this.#messagePort?.postMessage({
        type: 'hot-hook:full-reload',
        path: realFilePath,
        shouldBeReloadable,
      })
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

    watcher.on('change', this.#boundFileChangeHandler)
    watcher.on('unlink', this.#boundFileChangeHandler)

    return watcher
  }

  /**
   * Returns the code source for the import.meta.hot object.
   * We need to add this to every module since `import.meta.hot` is
   * scoped to each module.
   */
  #getImportMetaHotSource() {
    const hotFns = `
    import.meta.hot = {};
    import.meta.hot.dispose = async (callback) => {
      const { hot } = await import('hot-hook');
      hot.dispose(import.meta.url, callback);
    };

    import.meta.hot.decline = async () => {
      const { hot } = await import('hot-hook');
      hot.decline(import.meta.url);
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

    if (context.importAttributes?.hot) {
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
    const isRoot = !parentUrl
    if (isRoot) {
      this.#dependencyTree.addRoot(resultPath)
      this.#initialize(resultPath)
      return result
    }
    /**
     * Sometimes we receive a parentUrl that is just `data:`. I didn't really understand
     * why yet, for now we just ignore these cases.
     *
     * See https://github.com/tailwindlabs/tailwindcss/discussions/15105
     */
    if (parentUrl.protocol !== 'file:') return result

    const parentPath = fileURLToPath(parentUrl)
    const isHardcodedBoundary = this.#hardcodedBoundaryMatcher.match(resultPath)
    const reloadable = context.importAttributes?.hot === 'true' ? true : isHardcodedBoundary

    if (reloadable) {
      /**
       * If supposed to be reloadable, we must ensure it is imported dynamically
       * from the parent file. Otherwise, hot-hook can't invalidate the file
       */
      const isImportedDynamically =
        await this.#dynamicImportChecker.ensureFileIsImportedDynamicallyFromParent(
          parentPath,
          specifier,
        )

      /**
       * Throw an error if not dynamically imported and the option is set
       */
      if (!isImportedDynamically && this.#options.throwWhenBoundariesAreNotDynamicallyImported)
        throw new FileNotImportedDynamicallyException(parentPath, specifier, this.#projectRoot)

      /**
       * Otherwise, just add the file as not-reloadable ( so it will trigger a full reload )
       */
      this.#dependencyTree.addDependency(parentPath, {
        path: resultPath,
        reloadable: isImportedDynamically,
        isWronglyImported: !isImportedDynamically,
      })
    } else {
      this.#dependencyTree.addDependency(parentPath, { path: resultPath, reloadable })
    }

    if (this.#pathIgnoredMatcher.match(resultPath)) {
      return result
    }

    this.#watcher?.add(resultPath)
    const version = this.#dependencyTree.getVersion(resultPath).toString()
    resultUrl.searchParams.set('hot-hook', version)

    debug('Resolving %s with version %s', resultPath, version)
    return { ...result, url: resultUrl.href }
  }
}

let loader!: HotHookLoader
export const initialize: InitializeHook = async (data: InitializeHookOptions) => {
  loader = new HotHookLoader(data)
}
export const load: LoadHook = (...args) => loader?.load(...args)
export const resolve: ResolveHook = (...args) => loader?.resolve(...args)
