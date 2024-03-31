# Hot Hook Runner

The Hot Hook runner is a simple process manager that allows you to reload your NodeJS application only when necessary and requested by Hot Hook.

## Installation

```bash
pnpm add @hot-hook/runner
```

## Utilisation

```bash
pnpm hot-runner bin/server.js
```

To use with Typescript, you can pass a hook like this:

```bash
# Run with ts-node
pnpm hot-runner --node-args="--loader=ts-node/esm" bin/server.ts

# Run with TSX
pnpm hot-runner --node-args="--import=tsx" bin/server.ts
```


## Flags

### `--clear-screen`

Clears the console contents after each reload.

### `--node-args`

Arguments to pass to NodeJS. For example, `--node-args="--inspect"`.

### `--script-args`

Arguments to pass to your script. For example, `--script-args="--port=3000"`.
