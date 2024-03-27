import process from 'node:process'
import path from 'node:path'
import { promises as fs } from 'node:fs'
import { URL } from 'node:url'
import chokidar from 'chokidar'
import DependencyTree from './dependency_tree.js'
import { InitializeHook, LoadHook, ResolveHook } from 'node:module'
import debug from './debug.js'
import { MessagePort } from 'node:worker_threads'

const dependencyTree = new DependencyTree()

let messagePort: MessagePort | undefined
let reloadPaths: string[] = []

const includedPackages = process.env.HOT_INCLUDE_PACKAGES
  ? process.env.HOT_INCLUDE_PACKAGES.split(',')
  : []

function isPathIgnored(filePath: string) {
  if (filePath.includes('/.yarn/')) {
    return true
  }

  if (filePath.includes('/node_modules/')) {
    return !includedPackages.some((packageName) =>
      filePath.includes(`/node_modules/${packageName}`)
    )
  }

  return false
}

const watcher = chokidar
  .watch([])
  .on('change', async (relativeFilePath) => {
    const filePath = path.resolve(relativeFilePath)
    const realFilePath = await fs.realpath(filePath)

    debug('Changed %s', realFilePath)
    if (realFilePath.includes('config')) {
      messagePort?.postMessage({ type: 'full-reload' })
      return
    }

    const invalidatedFiles = dependencyTree.invalidateFileAndDependents(realFilePath)
    debug('Invalidating %s', Array.from(invalidatedFiles).join(', '))
    messagePort?.postMessage({ type: 'invalidating', paths: Array.from(invalidatedFiles) })
  })
  .on('unlink', (relativeFilePath) => {
    const filePath = path.resolve(relativeFilePath)
    debug('Deleted %s', filePath)
    dependencyTree.remove(filePath)
  })

export const load: LoadHook = async (url, context, nextLoad) => {
  const parsedUrl = new URL(url)
  if (parsedUrl.searchParams.has('hot-esm')) {
    parsedUrl.searchParams.delete('hot-esm')
    url = parsedUrl.href
  }

  if (parsedUrl.protocol === 'file:') {
    debug('Importing %s', parsedUrl.pathname)
  }

  const result = await nextLoad(url, context)

  if (result.format === 'module') {
    const hotFns = `
      import { hot as ____hot } from 'hot-hook'
      import.meta.hot = {}

      import.meta.hot.dispose = (callback) => {
        ____hot.dispose(import.meta.url, callback)
      };

      import.meta.hot.decline = () => {
        ____hot.decline(import.meta.url)
      }
    `

    result.source = hotFns + result.source
  }

  return result
}

export const resolve: ResolveHook = async (specifier, context, nextResolve) => {
  const parentUrl = (context.parentURL && new URL(context.parentURL)) as URL
  if (parentUrl?.searchParams.has('hot-esm')) {
    parentUrl.searchParams.delete('hot-esm')
    context = { ...context, parentURL: parentUrl.href }
  }

  const result = await nextResolve(specifier, context)

  const resultUrl = new URL(result.url)
  const resultPath = resultUrl.pathname
  if (resultUrl.protocol !== 'file:' || isPathIgnored(resultPath)) {
    return result
  }

  if (!dependencyTree.has(resultPath)) {
    debug('Watching %s', resultPath)
    dependencyTree.add(resultPath)
    watcher.add(resultPath)
  }

  const parentPath = parentUrl?.pathname
  if (parentPath) {
    dependencyTree.addDependent(resultPath, parentPath)
  }

  resultUrl.searchParams.set('hot-esm', dependencyTree.getVersion(resultPath)!.toString())
  return { ...result, url: resultUrl.href }
}

export const initialize: InitializeHook = (data: {
  /**
   * The message port to communicate with the parent thread.
   */
  messagePort?: MessagePort

  /**
   * An array of file paths that will trigger a full server reload when changed.
   */
  reload?: string[]
}) => {
  messagePort = data.messagePort
  reloadPaths = data.reload || []
}
