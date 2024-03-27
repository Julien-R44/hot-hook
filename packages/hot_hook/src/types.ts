export type MessageChannelMessage =
  | {
      type: 'hot-hook:full-reload'
      path: string
    }
  | {
      type: 'hot-hook:invalidated'
      paths: string[]
    }
