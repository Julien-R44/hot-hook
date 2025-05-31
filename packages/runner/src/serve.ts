import { relative } from 'node:path'
import { type ExecaChildProcess } from 'execa'
import { BaseCommand, args, flags } from '@adonisjs/ace'

import { runNode } from './helpers.js'

export class Serve extends BaseCommand {
  static commandName = 'serve'
  static description = 'Start the HTTP server'

  @args.string({ description: 'Path to the script file to execute' })
  declare script: string

  @flags.boolean({
    description: 'Clear the terminal screen before starting the server',
    default: true,
  })
  declare clearScreen: boolean

  @flags.array({ description: 'Node.js arguments to pass to the script' })
  declare nodeArgs: string[]

  @flags.array({ description: 'Script arguments to pass to the script' })
  declare scriptArgs: string[]

  #httpServer?: ExecaChildProcess<string>
  #onReloadAsked?: (updatedFile: string, shouldBeReloadable: boolean) => void
  #onFileInvalidated?: (invalidatedFiles: string[]) => void

  /**
   * Conditionally clear the terminal screen
   */
  #clearScreen() {
    if (this.clearScreen) {
      process.stdout.write('\u001Bc')
    }
  }

  /**
   * Log messages with hot-runner prefix
   */
  #log(message: string) {
    this.logger.log(`${this.colors.blue('[hot-runner]')} ${message}`)
  }

  /**
   * Starts the HTTP server
   */
  #startHTTPServer() {
    this.#httpServer = runNode(process.cwd(), {
      script: this.script,
      nodeArgs: this.nodeArgs,
      scriptArgs: this.scriptArgs,
    })

    this.#httpServer.on('message', async (message: any) => {
      if (typeof message !== 'object') return

      if ('type' in message && message.type === 'hot-hook:full-reload') {
        this.#onReloadAsked?.(message.path, message.shouldBeReloadable)
      }

      if ('type' in message && message.type === 'hot-hook:invalidated') {
        this.#onFileInvalidated?.(message.paths)
      }
    })

    this.#httpServer
      .then(() => {
        this.#log(`${this.script} exited.`)
      })
      .catch(() => {
        this.#log(`${this.colors.red(this.script + ' crashed.')}`)
      })
  }

  /**
   * Start the HTTP server and watch for full reload requests
   */
  async run() {
    this.#clearScreen()
    this.#log(`Starting ${this.colors.green(this.script)}`)
    this.#startHTTPServer()

    this.#onReloadAsked = (path, shouldBeReloadable) => {
      this.#clearScreen()

      const relativePath = relative(process.cwd(), path)
      const message = `${this.colors.green(relativePath)} changed. Restarting.`
      if (!shouldBeReloadable) {
        this.#log(message)
      } else {
        const warning = `${this.colors.yellow('This file should be reloadable, but a parent boundary was not dynamically imported.')}`
        this.#log(`${message}\n${warning}`)
      }

      this.#httpServer?.removeAllListeners()
      this.#httpServer?.kill('SIGKILL')
      this.#startHTTPServer()
    }

    this.#onFileInvalidated = (paths) => {
      this.#clearScreen()

      const updatedFile = paths[0]
      const relativePath = relative(process.cwd(), updatedFile)

      this.#log(`Invalidating ${this.colors.green(relativePath)} and its dependents`)
    }
  }

  /**
   * Close watchers and running child processes
   */
  async close() {
    if (this.#httpServer) {
      this.#httpServer.removeAllListeners()
      this.#httpServer.kill('SIGKILL')
    }
  }
}
