import { execaNode } from 'execa'

import type { RunOptions } from './types.js'

const DEFAULT_NODE_ARGS = ['--enable-source-maps']

/**
 * Runs a Node.js script as a child process and inherits the stdio streams
 */
export function runNode(cwd: string | URL, options: RunOptions) {
  const childProcess = execaNode(options.script, options.scriptArgs, {
    nodeOptions: DEFAULT_NODE_ARGS.concat(options.nodeArgs),
    preferLocal: true,
    windowsHide: false,
    localDir: cwd,
    cwd,
    buffer: false,
    stdio: options.stdio || 'inherit',
    env: {
      ...(options.stdio === 'pipe' ? { FORCE_COLOR: 'true' } : {}),
      ...options.env,
    },
  })

  return childProcess
}
