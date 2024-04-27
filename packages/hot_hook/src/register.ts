import { dirname, resolve } from 'node:path'
import { readPackageUp } from 'read-package-up'

import { hot } from './hot.js'

const pkgJson = await readPackageUp()
if (!pkgJson) {
  throw new Error('Could not find package.json')
}

const { packageJson, path: packageJsonPath } = pkgJson
const hotHookConfig = packageJson.hotHook

await hot.init({
  rootDirectory: dirname(packageJsonPath),
  boundaries: hotHookConfig?.boundaries,
  ignore: ['**/node_modules/**'].concat(hotHookConfig?.ignore || []),
  root: hotHookConfig?.root ? resolve(packageJsonPath, hotHookConfig.root) : undefined,
  restart: hotHookConfig?.restart,
})
