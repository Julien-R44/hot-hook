import type { MessagePort } from 'node:worker_threads'

export type MessageChannelMessage =
  | { type: 'hot-hook:full-reload'; path: string; shouldBeReloadable?: boolean }
  | { type: 'hot-hook:invalidated'; paths: string[] }

export interface InitOptions {
  /**
   * OnFullReloadAsked is called when a full server reload is requested
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
   * Root Directory will be used to resolve relative paths.
   * If not provided, it will be the directory of the root file.
   */
  rootDirectory?: string

  /**
   * Files that will create an HMR boundary. This is equivalent of importing
   * the module with `import.meta.hot.boundary` in the module.
   */
  boundaries?: string[]

  /**
   * List of files that should trigger a full reload when change.
   * Usually you will only need to add files that are not imported by
   * your application since imported files that need to trigger a full
   * reload will be automatically detected.
   *
   * For example an `.env` file is a good candidate for this list.
   * Hot Hook will watch these files and send a full reload message
   * to the main thread when they change.
   *
   * @default ['.env']
   */
  restart?: string[]

  /**
   * If true, the hook will throw an error if a boundary is not dynamically
   * imported.
   */
  throwWhenBoundariesAreNotDynamicallyImported?: boolean
}

export type InitializeHookOptions = Pick<
  InitOptions,
  | 'ignore'
  | 'root'
  | 'rootDirectory'
  | 'boundaries'
  | 'restart'
  | 'throwWhenBoundariesAreNotDynamicallyImported'
> & {
  /**
   * The message port to communicate with the parent thread.
   */
  messagePort?: MessagePort
}
