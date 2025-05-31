import fs from 'fs-extra'
import { join } from 'desm'
import path from 'node:path'
import pTimeout from 'p-timeout'
import { pEvent } from 'p-event'
import { execaNode } from 'execa'
import type { NodeOptions } from 'execa'
import { getActiveTest } from '@japa/runner'

export const projectRoot = join(import.meta.url, '../')

export async function fakeInstall(destination: string) {
  const { name: packageName, bin = {} } = await fs.readJson(
    path.resolve(projectRoot, 'package.json')
  )

  await fs.ensureSymlink(projectRoot, path.resolve(destination, 'node_modules', packageName))

  if (typeof bin === 'string') {
    const binPath = bin
    const binName = packageName
    await fs.ensureSymlink(
      path.resolve(projectRoot, binPath),
      path.resolve(destination, 'node_modules', '.bin', binName)
    )
  } else {
    for (const [binName, binPath] of Object.entries(bin)) {
      await fs.ensureSymlink(
        path.resolve(projectRoot, binPath as any),
        path.resolve(destination, 'node_modules', '.bin', binName)
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
    }`
  )
}

export function runProcess(scriptPath: string, options?: NodeOptions) {
  const activeTest = getActiveTest()
  if (!activeTest) {
    throw new Error('Cannot run a process outside of a test')
  }

  const child = execaNode(scriptPath, { nodeOptions: [], buffer: false, ...options })
  activeTest.cleanup(() => void child.kill())

  // child.stdout?.pipe(process.stdout)
  // child.stderr?.pipe(process.stderr)

  return {
    child,
    async waitForOutput(output: string, timeout = 10_000) {
      const waitUntilOutput = async () => {
        await pEvent(child.stdout!, 'data', (value) => value.toString().includes(output))
      }

      return await pTimeout(waitUntilOutput(), {
        milliseconds: timeout,
        message: `Timeout waiting for "${output}"`,
      })
    },

    async waitForExit() {
      await child
    },
  }
}
