/* eslint-disable unicorn/filename-case */
interface ImportMeta {
  readonly hot?: {
    dispose(callback: () => Promise<void> | void): void
    decline(): void
    boundary: Record<string, any>
  }
}
