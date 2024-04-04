import { resolve } from 'node:path'
import picomatch from 'picomatch'

export class Matcher {
  #rootDirectory: string
  #matcher: picomatch.Matcher

  constructor(rootDirectory: string, patterns: picomatch.Glob = []) {
    this.#rootDirectory = rootDirectory

    patterns = Array.isArray(patterns) ? patterns : [patterns]
    const absolutePatterns = patterns.map((pattern) => {
      if (pattern.startsWith('../')) return resolve(rootDirectory, pattern)
      return pattern
    })

    this.#matcher = picomatch(absolutePatterns || [], { dot: true })
  }

  /**
   * Check if a path matches the patterns
   */
  match(filePath: string) {
    if (filePath.startsWith(this.#rootDirectory)) {
      filePath = filePath.slice(this.#rootDirectory.length).replace(/^\//, '')
    }

    return this.#matcher(filePath)
  }
}
