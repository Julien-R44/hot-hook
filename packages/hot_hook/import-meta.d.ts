interface ImportMeta {
	readonly hot?: {
    dispose(callback: () => Promise<void>): void
    decline(): void
  }
}
