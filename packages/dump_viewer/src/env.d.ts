type HotHookDump = typeof import('./fixtures/dump.json')

interface Window {
  __HOT_HOOK_DUMP__: HokHookDump
}
