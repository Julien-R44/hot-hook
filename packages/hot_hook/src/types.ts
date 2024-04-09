import { MessagePort } from 'node:worker_threads'

export type MessageChannelMessage =
  | { type: 'hot-hook:full-reload'; path: string }
  | { type: 'hot-hook:invalidated'; paths: string[] }

export interface InitOptions {
  /**
   * onFullReloadAsked is called when a full server reload is requested
   * by the hook. You should use this to kill the current process and
   * restart it.
   */
  onFullReloadAsked?: () => void

  /**
   * Paths that will not be watched by the hook.
   * @default ['/node_modules/']
   */
  ignore?: string[]

  /**
   * Path to the root file of the application.
   */
  root?: string

  /**
   * Files that will create an HMR boundary. This is equivalent of importing
   * the module with `import.meta.hot.boundary` in the module.
   */
  boundaries?: string[]
}

export type InitializeHookOptions = Pick<InitOptions, 'ignore' | 'root' | 'boundaries'> & {
  /**
   * The message port to communicate with the parent thread.
   */
  messagePort?: MessagePort
}
