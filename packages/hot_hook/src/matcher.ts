import picomatch from 'picomatch'

export class Matcher {
  #rootDirectory: string
  #matcher: picomatch.Matcher

  constructor(rootDirectory: string, patterns: picomatch.Glob = []) {
    this.#rootDirectory = rootDirectory
    this.#matcher = picomatch(patterns || [], { dot: true })
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
