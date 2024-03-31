import { BaseCommand, args, flags } from '@adonisjs/ace'
import { type ExecaChildProcess } from 'execa'
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
  #onReloadAsked?: () => void

  /**
   * Conditionally clear the terminal screen
   */
  #clearScreen() {
    if (this.clearScreen) {
      process.stdout.write('\u001Bc')
    }
  }

  /**
   * Starts the HTTP server
   */
  #startHTTPServer(mode: 'blocking' | 'nonblocking') {
    this.#httpServer = runNode(process.cwd(), {
      script: this.script,
      nodeArgs: this.nodeArgs,
      scriptArgs: this.scriptArgs,
    })

    this.#httpServer.on('message', async (message) => {
      if (typeof message !== 'object') return

      if ('type' in message && message.type === 'hot-hook:full-reload') {
        this.#onReloadAsked?.()
      }
    })

    this.#httpServer
      .then(() => {
        if (mode !== 'nonblocking') {
          this.logger.info('Underlying HTTP server closed. Still watching for changes')
        }
      })
      .catch(() => {
        if (mode !== 'nonblocking') {
          this.logger.info('Underlying HTTP server died. Still watching for changes')
        }
      })
  }

  /**
   * Start the HTTP server and watch for full reload requests
   */
  async run() {
    this.#clearScreen()
    this.logger.info('starting HTTP server...')
    this.#startHTTPServer('nonblocking')

    this.#onReloadAsked = () => {
      this.#clearScreen()
      this.logger.info('Full reload requested. Restarting HTTP server...')
      this.#httpServer?.removeAllListeners()
      this.#httpServer?.kill('SIGKILL')
      this.#startHTTPServer('blocking')
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
