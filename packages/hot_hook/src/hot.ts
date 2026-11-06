import module from 'node:module'
import { MessageChannel } from 'node:worker_threads'
import type { LoadHookSync, ResolveHookSync } from 'node:module'

import debug from './debug.js'
import type { InitOptions, InitializeHookOptions, MessageChannelMessage } from './types.js'

/**
 * Whether this Node.js version can run hot-hook with `module.registerHooks()`.
 *
 * `registerHooks()` exists since 22.15, but until 22.22.3, 24.11.1 and 25.1.0,
 * a synchronous `load` hook fails on CommonJS modules when hooks from
 * `module.register()` are also registered, like ts-node's or older tsx's.
 */
function canUseSyncHooks() {
  const [major, minor, patch] = process.versions.node.split('.').map(Number)
  if (major >= 26) return true

  const minimum = ({ 22: [22, 3], 24: [11, 1], 25: [1, 0] } as Record<number, number[]>)[major]
  if (!minimum) return false
  return minor > minimum[0] || (minor === minimum[0] && patch >= minimum[1])
}

class Hot {
  #options!: InitOptions
  #messageChannel!: MessageChannel
  #declinePaths = new Set<string>()
  #disposeCallbacks = new Map<string, () => void>()
  #processMessageHandler?: (message: any) => void

  #hasOneDeclinedPath(paths: string[]) {
    return paths.some((path) => this.#declinePaths.has(path))
  }

  /**
   * Handle messages received from the hook's worker thread
   */
  #onMessage(message: MessageChannelMessage) {
    if (message.type === 'hot-hook:full-reload') {
      process.send?.({
        type: 'hot-hook:full-reload',
        path: message.path,
        shouldBeReloadable: message.shouldBeReloadable,
      })

      this.#options.onFullReloadAsked?.()
    }

    if (message.type === 'hot-hook:invalidated') {
      if (this.#hasOneDeclinedPath(message.paths)) {
        process.send?.({ type: 'hot-hook:full-reload', paths: message.paths })
        this.#options.onFullReloadAsked?.()
        return
      }
      process.send?.({ type: 'hot-hook:invalidated', paths: message.paths })

      for (const url of message.paths) {
        const callback = this.#disposeCallbacks.get(url)
        callback?.()
      }
    }
  }

  /**
   * Register the hot reload hooks
   */
  async init(options: InitOptions) {
    const envWatch = process.env.HOT_HOOK_WATCH

    this.#options = Object.assign(
      {
        watch: envWatch !== undefined ? envWatch !== 'false' : true,
        ignore: [
          '**/node_modules/**',
          /**
           * Vite has a bug where it create multiple files with a
           * timestamp. This cause hot-hook to restart in loop.
           * See https://github.com/vitejs/vite/issues/13267
           */
          '**/vite.config.js.timestamp*',
          '**/vite.config.ts.timestamp*',
        ],
        restart: ['.env'],
      },
      options,
    )

    debug('Hot hook options %o', this.#options)

    /**
     * First, we setup a message channel to be able to communicate
     * between the hook and the application process, since with the
     * `module.register()` fallback hooks are running in a worker thread
     */
    this.#messageChannel = new MessageChannel()

    const data: InitializeHookOptions = {
      root: this.#options.root,
      watch: this.#options.watch,
      ignore: this.#options.ignore,
      restart: this.#options.restart,
      boundaries: this.#options.boundaries,
      messagePort: this.#messageChannel.port2,
      rootDirectory: this.#options.rootDirectory,
      throwWhenBoundariesAreNotDynamicallyImported:
        this.#options.throwWhenBoundariesAreNotDynamicallyImported,
    }

    /**
     * Prefer synchronous in-thread hooks since `module.register()` is
     * deprecated (DEP0205). The loader then runs on this thread but keeps
     * using the message channel, like the off-thread fallback.
     */
    if (canUseSyncHooks()) {
      const { HotHookLoader } = await import('./loader.js')
      const loader = new HotHookLoader(data)

      /**
       * Safe casts: hooks return synchronously when `nextResolve`/`nextLoad`
       * do, which is always the case with `registerHooks()`
       */
      module.registerHooks({
        resolve: loader.resolve as ResolveHookSync,
        load: loader.load as LoadHookSync,
      })

      this.#messageChannel.port2.unref()
      await loader.whenWatcherReady()
    } else {
      module.register('hot-hook/loader', {
        parentURL: import.meta.url,
        transferList: [this.#messageChannel.port2],
        data,
      })
    }

    this.#messageChannel.port1.on('message', this.#onMessage.bind(this))
    this.#messageChannel.port1.unref()

    /**
     * When watch is disabled, we listen for file-changed messages from
     * the parent process and forward them to the loader.
     *
     * We unref the IPC channel so that the child process can exit naturally
     * when an error occurs (instead of being kept alive by the IPC channel).
     */
    if (!this.#options.watch) {
      if (this.#processMessageHandler) {
        process.off('message', this.#processMessageHandler)
      }

      this.#processMessageHandler = (message: any) => {
        if (message?.type === 'hot-hook:file-changed') {
          this.#messageChannel.port1.postMessage(message)
        }
      }
      process.on('message', this.#processMessageHandler)
      process.channel?.unref()
    }
  }

  /**
   * Import.meta.hot.dispose internally calls this method
   *
   * Dispose is useful for cleaning up resources when a module is reloaded
   */
  dispose(url: string, callback: () => void) {
    this.#disposeCallbacks.set(new URL(url).pathname, callback)
  }

  /**
   * Import.meta.hot.decline internally calls this method
   *
   * Decline allows you to mark a module as not reloadable and
   * will trigger a full server reload when it changes
   */
  decline(url: string) {
    this.#declinePaths.add(new URL(url).pathname)
  }

  /**
   * Dump the current state hot hook
   */
  async dump() {
    this.#messageChannel.port1.postMessage({ type: 'hot-hook:dump' })
    const result: any = await new Promise((resolve) =>
      this.#messageChannel.port1.once('message', (message) => resolve(message)),
    )

    return result.dump
  }
}

// @ts-expect-error ignore
const hot: Hot = globalThis.hot || new Hot()
// @ts-expect-error ignore
globalThis.hot = hot
export { hot }
