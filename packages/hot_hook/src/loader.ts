import { fileURLToPath } from 'node:url'
import { access, realpath } from 'node:fs/promises'
import chokidar, { type FSWatcher } from 'chokidar'
import type { MessagePort } from 'node:worker_threads'
import { resolve as pathResolve, dirname } from 'node:path'
import type { InitializeHook, LoadHook, ResolveHook } from 'node:module'

import debug from './debug.js'
import { Matcher } from './matcher.js'
import DependencyTree from './dependency_tree.js'
import { DynamicImportChecker } from './dynamic_import_checker.js'
import { FileNotImportedDynamicallyException } from './errors/file_not_imported_dynamically_exception.js'
import type {
  FileChangeAction,
  InitializeHookOptions,
  MessageChannelMessage,
  MessageChannelPerType,
} from './types.js'

export class HotHookLoader {
  #options: InitializeHookOptions
  #projectRoot!: string
  #reloadMatcher!: Matcher
  #messagePort?: MessagePort
  #watcher!: FSWatcher
  #pathIgnoredMatcher!: Matcher
  #pathIncludedMatcher!: Matcher
  #dependencyTree: DependencyTree
  #hardcodedBoundaryMatcher!: Matcher
  #dynamicImportChecker!: DynamicImportChecker

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
    this.#pathIncludedMatcher = new Matcher(this.#projectRoot, this.#options.include || [])
    this.#hardcodedBoundaryMatcher = new Matcher(this.#projectRoot, this.#options.boundaries)

    this.#watcher = this.#createWatcher()
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

  #postMessage<T extends MessageChannelMessage['type']>(type: T, data: MessageChannelPerType[T]) {
    this.#messagePort?.postMessage({ type, ...data })
  }

  /**
   * When a message is received from the main thread
   */
  #onMessage(message: any) {
    if (message.type !== 'hot-hook:dump') return
    this.#messagePort?.postMessage({ type: 'hot-hook:dump', dump: this.#dependencyTree.dump() })
  }

  /**
   * When a file changes, invalidate it and its dependents.
   */
  async #onFileChange(relativeFilePath: string, action: FileChangeAction) {
    debug('File change %s', { relativeFilePath, action })
    const filePath = pathResolve(relativeFilePath)

    /**
     * If the file is removed, we must remove it from the dependency tree
     * and stop watching it.
     */
    if (action === 'unlink') {
      debug('File removed %s', filePath)
      this.#watcher.unwatch(filePath)
      this.#postMessage('hot-hook:file-changed', { path: filePath, action: 'unlink' })

      return this.#dependencyTree.remove(filePath)
    }

    /**
     * Defensive check to ensure the file still exists.
     * If it doesn't, we just return and do nothing.
     */
    const fileExists = await this.#checkIfFileExists(filePath)
    if (!fileExists) {
      debug('File does not exist anymore %s', filePath)
      this.#watcher.unwatch(filePath)
      return this.#dependencyTree.remove(filePath)
    }

    /**
     * Invalidate the dynamic import cache for the file since we
     * gonna need to recheck the dynamic imports.
     */
    this.#dynamicImportChecker.invalidateCache(filePath)

    /**
     * If the file is an hardcoded reload file, we trigger a full reload.
     */
    const realFilePath = await realpath(filePath)
    if (this.#reloadMatcher.match(realFilePath)) {
      debug('Full reload (hardcoded `restart` file) %s', realFilePath)
      return this.#postMessage('hot-hook:full-reload', { path: realFilePath })
    }

    /**
     * Check if the file exist in the dependency tree. If not, means it was still
     * not loaded, so we just send a "file-changed" message
     */
    if (!this.#dependencyTree.isInside(realFilePath)) {
      debug('File not in dependency tree, sending file-changed message %s', realFilePath)
      return this.#postMessage('hot-hook:file-changed', { path: realFilePath, action })
    }

    /**
     * If the file is not reloadable according to the dependency tree,
     * we trigger a full reload.
     */
    const { reloadable, shouldBeReloadable } = this.#dependencyTree.isReloadable(realFilePath)
    if (!reloadable) {
      debug('Full reload (not-reloadable file) %s', realFilePath)
      return this.#postMessage('hot-hook:full-reload', { path: realFilePath, shouldBeReloadable })
    }

    /**
     * Otherwise, we invalidate the file and its dependents
     */
    const invalidatedFiles = this.#dependencyTree.invalidateFileAndDependents(realFilePath)
    debug('Invalidating %s', Array.from(invalidatedFiles).join(', '))
    this.#postMessage('hot-hook:invalidated', { paths: [...invalidatedFiles] })
  }

  /**
   * Create the chokidar watcher instance.
   */
  #createWatcher() {
    const watcher = chokidar.watch('.', {
      ignoreInitial: true,
      cwd: this.#projectRoot,
      ignored: (file, stats) => {
        if (file === this.#projectRoot) return false
        if (!stats) return false

        if (this.#pathIgnoredMatcher.match(file)) {
          console.log('PM File %s is ignored', file)
          return true
        }
        if (this.#reloadMatcher.match(file)) return false

        if (stats.isDirectory()) return false
        console.log('File %s is ignored', file, !this.#pathIncludedMatcher.match(file))

        return !this.#pathIncludedMatcher.match(file)
      },
    })

    watcher.on('change', (path) => this.#onFileChange(path, 'change'))
    watcher.on('unlink', (path) => this.#onFileChange(path, 'unlink'))
    watcher.on('add', (path) => this.#onFileChange(path, 'add'))

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
    console.log('Resolving specifier:', specifier, 'with context:', context)
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

    this.#watcher.add(resultPath)
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
