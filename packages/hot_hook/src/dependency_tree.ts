import { dirname, relative } from 'node:path'

/**
 * Represent a file node in the dependency tree.
 */
interface FileNode {
  /**
   * Absolute path to the file
   */
  path: string

  /**
   * Whether the file is marked as reloadable or not
   */
  reloadable: boolean

  /**
   * Set of files imported by this file
   */
  dependencies: Set<FileNode>

  /**
   * Set of files importing this file
   */
  dependents: Set<FileNode>

  /**
   * Set of files that are parents of this file
   */
  parents: Set<FileNode> | null

  /**
   * Version of the file. Incremented when the file is invalidated
   */
  version: number
}

export default class DependencyTree {
  #tree!: FileNode
  #pathMap: Map<string, FileNode> = new Map()

  constructor(options: { root: string }) {
    this.#tree = {
      version: 0,
      parents: null,
      reloadable: false,
      path: options.root,
      dependents: new Set(),
      dependencies: new Set(),
    }

    this.#pathMap.set(this.#tree.path, this.#tree)
  }

  /**
   * Get the version of a file
   */
  getVersion(path: string): number {
    const node = this.#pathMap.get(path)
    if (!node) throw new Error(`Node ${path} does not exist`)

    return node.version
  }

  /**
   * Add a dependency to a file
   */
  addDependency(parentPath: string, dependency: { path: string; reloadable?: boolean }): void {
    let parentNode = this.#pathMap.get(parentPath)
    if (!parentNode) return

    let childNode = this.#pathMap.get(dependency.path)
    if (!childNode) {
      childNode = {
        version: 0,
        path: dependency.path,
        parents: new Set(),
        dependents: new Set(),
        dependencies: new Set(),
        reloadable: dependency.reloadable || false,
      }
      this.#pathMap.set(dependency.path, childNode)
    } else {
      childNode.reloadable = dependency.reloadable || false
    }

    childNode.parents?.add(parentNode)
    parentNode.dependencies.add(childNode)
  }

  /**
   * Add a dependent to a file
   */
  addDependent(dependentPath: string, parentPath: string): void {
    let dependentNode = this.#pathMap.get(dependentPath)
    if (!dependentNode) return

    let parentNode = this.#pathMap.get(parentPath)
    if (!parentNode) return

    dependentNode.dependents.add(parentNode)
  }

  /**
   * Invalidate a file and all its dependents
   */
  invalidateFileAndDependents(filePath: string): Set<string> {
    const invalidatedFiles = new Set<string>()
    const queue = [filePath]
    while (queue.length > 0) {
      const currentPath = queue.pop()!
      if (!invalidatedFiles.has(currentPath)) {
        const node = this.#pathMap.get(currentPath)
        if (!node) throw new Error(`Node ${currentPath} does not exist`)
        node.version++
        invalidatedFiles.add(currentPath)
        queue.push(...Array.from(node.dependents).map((n) => n.path))
      }
    }

    return invalidatedFiles
  }

  /**
   * Remove a file from the dependency tree
   */
  remove(path: string): void {
    const node = this.#pathMap.get(path)
    if (!node) throw new Error(`Node ${path} does not exist`)

    if (node.parents) {
      for (const parent of node.parents) {
        parent.dependencies.delete(node)
      }
    }

    if (node.dependents) {
      for (const dependent of node.dependents) {
        dependent.parents?.delete(node)
      }
    }

    this.#pathMap.delete(path)
  }

  /**
   * Check if a file is reloadable.
   * Basically the algorithm is :
   * - For a given file, we will go up the whole dependency tree until we can reach the ROOT file
   *  = the entry point of the application/the executed script
   * - If we can reach the ROOT file without encountering any reloadable file, then it means we
   *  need to do a FULL RELOAD.
   * - If all paths to reach the ROOT file go through reloadable files, then it means we can do HMR !
   */
  isReloadable(path: string): boolean {
    const node = this.#pathMap.get(path)
    if (!node) throw new Error(`Node ${path} does not exist`)

    const checkPathToRoot = (currentNode: FileNode, visited: Set<string> = new Set()): boolean => {
      if (currentNode.reloadable) {
        return true
      }

      if (visited.has(currentNode.path)) {
        return true
      }

      visited.add(currentNode.path)

      if (!currentNode.parents || currentNode.parents.size === 0) {
        return false
      }

      for (const parent of currentNode.parents) {
        if (!checkPathToRoot(parent, new Set(visited))) return false
      }

      return true
    }

    const result = checkPathToRoot(node)
    return result
  }

  dump() {
    const rootDirname = dirname(this.#tree.path)
    const isNodeModule = (path: string) => path.includes('node_modules')

    return Array.from(this.#pathMap.values()).map((node) => ({
      path: relative(rootDirname, node.path),
      boundary: node.reloadable,
      reloadable: isNodeModule(node.path) ? false : this.isReloadable(node.path),
      version: node.version,
      dependencies: Array.from(node.dependencies).map((n) => relative(rootDirname, n.path)),
      dependents: Array.from(node.dependents).map((n) => relative(rootDirname, n.path)),
    }))
  }
}
