import picomatch from 'picomatch'
import { resolve } from 'node:path'

export class Matcher {
  #matcher: picomatch.Matcher

  constructor(rootDirectory: string, patterns: picomatch.Glob = []) {
    patterns = Array.isArray(patterns) ? patterns : [patterns]

    const absolutePatterns = patterns
      .map((pattern) => {
        /**
         * Do not resolve double star patterns because they are not relative to the root
         */
        if (pattern.startsWith('**')) return pattern

        /**
         * Resolve the pattern to the root directory. All patterns are relative to the root
         */
        return resolve(rootDirectory, pattern)
      })
      .map((path) => path.replace(/\\/g, '/'))

    this.#matcher = picomatch(absolutePatterns || [], { dot: true, posixSlashes: true })
  }

  /**
   * Check if a path matches the patterns
   */
  match(filePath: string) {
    return this.#matcher(resolve(filePath))
  }
}
