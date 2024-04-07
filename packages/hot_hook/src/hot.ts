import { register } from 'node:module'
import { InitOptions, InitializeHookOptions, MessageChannelMessage } from './types.js'

class Hot {
  #options!: InitOptions
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
      process.send?.({ type: 'hot-hook:full-reload', path: message.path })
      this.#options.onFullReloadAsked?.()
    }

    if (message.type === 'hot-hook:invalidated') {
      if (this.#hasOneDeclinedPath(message.paths)) {
        process.send?.({ type: 'hot-hook:full-reload', paths: message.paths })
        this.#options.onFullReloadAsked?.()
        return
      } else {
        process.send?.({ type: 'hot-hook:invalidated', paths: message.paths })
      }

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
    this.#options = {
      ignore: ['**/node_modules/**'],
      ...options,
    }

    /**
     * First, we setup a message channel to be able to communicate
     * between the hook and the application process since hooks
     * are running in a worker thread
     */
    const { port1, port2 } = new MessageChannel()

    register('hot-hook/loader', {
      parentURL: import.meta.url,
      transferList: [port2],
      data: {
        messagePort: port2,
        root: this.#options.root,
        ignore: this.#options.ignore,
        boundaries: this.#options.boundaries,
      } satisfies InitializeHookOptions,
    })

    port1.on('message', this.#onMessage.bind(this))
  }

  /**
   * import.meta.hot.dispose internally calls this method
   *
   * Dispose is useful for cleaning up resources when a module is reloaded
   */
  dispose(url: string, callback: () => void) {
    this.#disposeCallbacks.set(new URL(url).pathname, callback)
  }

  /**
   * import.meta.hot.decline internally calls this method
   *
   * Decline allows you to mark a module as not reloadable and
   * will trigger a full server reload when it changes
   */
  decline(url: string) {
    this.#declinePaths.add(new URL(url).pathname)
  }
}

// @ts-ignore
const hot: Hot = globalThis.hot || new Hot()
// @ts-ignore
globalThis.hot = hot
export { hot }
