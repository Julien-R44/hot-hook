import fs from 'fs-extra'
import { join } from 'desm'
import path from 'node:path'
import pTimeout from 'p-timeout'
import { pEvent } from 'p-event'
import { execaNode } from 'execa'
import type { Options } from 'execa'
import { getActiveTest } from '@japa/runner'

export const projectRoot = join(import.meta.url, '../')

export async function fakeInstall(destination: string) {
  const { name: packageName, bin = {} } = await fs.readJson(
    path.resolve(projectRoot, 'package.json'),
  )

  await fs.ensureSymlink(projectRoot, path.resolve(destination, 'node_modules', packageName))

  if (typeof bin === 'string') {
    const binPath = bin
    const binName = packageName
    await fs.ensureSymlink(
      path.resolve(projectRoot, binPath),
      path.resolve(destination, 'node_modules', '.bin', binName),
    )
  } else {
    for (const [binName, binPath] of Object.entries(bin)) {
      await fs.ensureSymlink(
        path.resolve(projectRoot, binPath as any),
        path.resolve(destination, 'node_modules', '.bin', binName),
      )
    }
  }
}

export async function createHandlerFile(options: { path: string; response: string }) {
  const activeTest = getActiveTest()
  if (!activeTest) throw new Error('No active test')

  const { path: handlerPath, response } = options
  await activeTest.context.fs.create(
    handlerPath,
    `export default function(request, response) {
      response.writeHead(200, {'Content-Type': 'text/plain'})
      response.end('${response}')
    }`,
  )
}

export function runProcess(scriptPath: string, options?: Options) {
  const activeTest = getActiveTest()
  if (!activeTest) {
    throw new Error('Cannot run a process outside of a test')
  }

  const subprocess = execaNode(scriptPath, { nodeOptions: [], buffer: false, ...options })
  const child = subprocess.nodeChildProcess
  activeTest.cleanup(() => void subprocess.kill())
  // Killing the process in cleanup rejects it; tests that care await `waitForExit`
  subprocess.catch(() => {})

  /**
   * Execa reads IPC messages as soon as the process starts, so a message sent
   * before a test listens for it would be lost. Record them all instead.
   */
  const messages: any[] = []
  child.on('message', (message) => messages.push(message))

  // child.stdout?.pipe(process.stdout)
  // child.stderr?.pipe(process.stderr)

  return {
    child,
    async waitForMessage(predicate: (message: any) => boolean) {
      const received = messages.find(predicate)
      if (received) return received
      return await pEvent(child, 'message', predicate)
    },

    async waitForOutput(output: string, timeout = 10_000) {
      const waitUntilOutput = async () => {
        await pEvent(subprocess.stdout!, 'data', (value: Buffer) =>
          value.toString().includes(output),
        )
      }

      return await pTimeout(waitUntilOutput(), {
        milliseconds: timeout,
        message: `Timeout waiting for "${output}"`,
      })
    },

    async waitForExit() {
      await subprocess
    },
  }
}
