import chokidar from 'chokidar'
import { EventEmitter } from 'node:events'
import { Worker, parentPort, workerData } from 'node:worker_threads'

import debug from './debug.js'

/**
 * Runs a chokidar watcher on a dedicated worker thread and re-emits its
 * `change`, `unlink` and `ready` events.
 *
 * Used with in-thread hooks: on the main thread, the watcher would keep the
 * process alive and could only scan files while the application is idle.
 * The worker is unref'd after its initial scan, so it does not keep the
 * process alive.
 */
export class WatcherThread extends EventEmitter {
  #worker: Worker

  constructor(paths: string[]) {
    super()

    /**
     * Empty `execArgv` so preloads like `--import=hot-hook/register` don't run
     * again in the worker
     */
    this.#worker = new Worker(new URL(import.meta.url), {
      execArgv: [],
      workerData: { hotHookWatcherPaths: paths },
    })
    this.#worker.on('message', ({ event, path }) => this.emit(event, path))
    this.#worker.on('error', (error) => debug('Watcher thread error %O', error))

    /**
     * Never leave `hot.init()` waiting if the worker dies before its scan
     */
    this.#worker.once('exit', () => this.emit('ready'))

    /**
     * Keep the process alive until the initial scan is done, so that
     * `hot.init()` can wait for it
     */
    this.once('ready', () => this.#worker.unref())
  }

  add(paths: string | string[]) {
    this.#worker.postMessage(paths)
    return this
  }
}

if (workerData?.hotHookWatcherPaths) {
  const watcher = chokidar.watch(workerData.hotHookWatcherPaths)
  watcher.on('change', (path) => parentPort!.postMessage({ event: 'change', path }))
  watcher.on('unlink', (path) => parentPort!.postMessage({ event: 'unlink', path }))
  watcher.on('ready', () => parentPort!.postMessage({ event: 'ready' }))
  watcher.on('error', (error) => debug('Watcher error %O', error))
  parentPort!.on('message', (paths) => watcher.add(paths))
}
