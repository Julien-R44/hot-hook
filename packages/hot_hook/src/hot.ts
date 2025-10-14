import { register } from 'node:module'
import { MessageChannel } from 'node:worker_threads'

import debug from './debug.js'
import type { InitOptions, InitializeHookOptions, MessageChannelMessage } from './types.js'

class Hot {
  #options!: InitOptions
  #messageChannel!: MessageChannel
  #declinePaths = new Set<string>()
  #disposeCallbacks = new Map<string, () => void>()

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

    if (message.type === 'hot-hook:file-changed') {
      process.send?.(message)
    }
  }

  /**
   * Register the hot reload hooks
   */
  async init(options: InitOptions) {
    const envIgnore = process.env.HOT_HOOK_IGNORE?.split(',').map((p) => p.trim())
    const envRestart = process.env.HOT_HOOK_RESTART?.split(',').map((p) => p.trim())
    const envBoundaries = process.env.HOT_HOOK_BOUNDARIES?.split(',').map((p) => p.trim())
    const envInclude = process.env.HOT_HOOK_INCLUDE?.split(',').map((p) => p.trim())

    this.#options = Object.assign(
      {
        include: envInclude || ['**/*'],
        boundaries: envBoundaries || [],
        restart: envRestart || ['.env'],
        throwWhenBoundariesAreNotDynamicallyImported: false,
        ignore: envIgnore || [
          '**/node_modules/**',
          /**
           * Vite has a bug where it create multiple files with a
           * timestamp. This cause hot-hook to restart in loop.
           * See https://github.com/vitejs/vite/issues/13267
           */
          '**/vite.config.js.timestamp*',
          '**/vite.config.ts.timestamp*',
        ],
      },
      options,
    )

    debug('Hot hook options %o', this.#options)

    /**
     * First, we setup a message channel to be able to communicate
     * between the hook and the application process since hooks
     * are running in a worker thread
     */
    this.#messageChannel = new MessageChannel()

    register('hot-hook/loader', {
      parentURL: import.meta.url,
      transferList: [this.#messageChannel.port2],
      data: {
        root: this.#options.root,
        ignore: this.#options.ignore,
        include: this.#options.include,
        restart: this.#options.restart,
        boundaries: this.#options.boundaries,
        messagePort: this.#messageChannel.port2,
        rootDirectory: this.#options.rootDirectory,
        throwWhenBoundariesAreNotDynamicallyImported:
          this.#options.throwWhenBoundariesAreNotDynamicallyImported,
      } satisfies InitializeHookOptions,
    })

    this.#messageChannel.port1.on('message', this.#onMessage.bind(this))
    this.#messageChannel.port1.unref()
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
