export default class DependencyTree {
  #versions = new Map<string, number>()
  #dependents = new Map<string, Set<string>>()

  add(filePath: string) {
    if (!this.#versions.has(filePath)) {
      this.#versions.set(filePath, 1)
      this.#dependents.set(filePath, new Set())
    }
  }

  remove(filePath: string) {
    if (this.#versions.has(filePath)) {
      this.#versions.delete(filePath)
      this.#dependents.delete(filePath)
    }
  }

  has(filePath: string) {
    return this.#versions.has(filePath)
  }

  getVersion(filePath: string) {
    return this.#versions.get(filePath)
  }

  invalidate(filePath: string) {
    if (this.#versions.has(filePath)) {
      this.#versions.set(filePath, this.getVersion(filePath)! + 1)
    }
  }

  invalidateFileAndDependents(filePath: string) {
    const invalidatedFiles = new Set<string>()
    const queue = [filePath]
    while (queue.length > 0) {
      const currentPath = queue.pop()!
      if (!invalidatedFiles.has(currentPath)) {
        this.invalidate(currentPath)
        invalidatedFiles.add(currentPath)
        queue.push(...this.getDependents(currentPath)!)
      }
    }

    return invalidatedFiles
  }

  getDependents(filePath: string) {
    if (this.#dependents.has(filePath)) {
      return this.#dependents.get(filePath)
    }

    return new Set<string>()
  }

  addDependent(filePath: string, dependentFilePath: string) {
    if (this.#dependents.has(filePath)) {
      this.#dependents.get(filePath)!.add(dependentFilePath)
    } else {
      throw new Error('Adding dependency not tracked in tree. Likely a bug in the library.')
    }
  }
}
