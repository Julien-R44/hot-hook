import { join } from 'desm'
import { readFile } from 'node:fs/promises'

/**
 * Returns the HTML content of the Hot Hook Dump Viewer
 */
export async function dumpViewer() {
  /**
   * Dump the dependency tree
   */
  const { hot } = await import('hot-hook')
  const dump = await hot.dump()

  /**
   * Load the HTML content and replace the placeholder with the dump
   */
  const htmlLocation = join(import.meta.url, 'index.html')
  let html = await readFile(htmlLocation, 'utf8')
  html = html.replace('$__hot_hook_placeholder__', JSON.stringify(dump))

  return html
}
