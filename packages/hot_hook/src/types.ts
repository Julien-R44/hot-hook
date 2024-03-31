import picomatch from 'picomatch'
import { MessagePort } from 'node:worker_threads'

export type MessageChannelMessage =
  | { type: 'hot-hook:full-reload'; path: string }
  | { type: 'hot-hook:invalidated'; paths: string[] }

export interface InitOptions {
  /**
   * An array of globs that will trigger a full server reload when changed.
   */
  reload?: picomatch.Glob

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
  ignore?: picomatch.Glob

  /**
   * The project root directory.
   */
  projectRoot: string
}

export type InitializeHookOptions = Pick<InitOptions, 'ignore' | 'reload' | 'projectRoot'> & {
  /**
   * The message port to communicate with the parent thread.
   */
  messagePort?: MessagePort
}
