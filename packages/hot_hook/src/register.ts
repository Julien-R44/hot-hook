import { resolve } from 'node:path'
import { hot } from './hot.js'
import { readPackageUp } from 'read-package-up'

const pkgJson = await readPackageUp()
if (!pkgJson) {
  throw new Error('Could not find package.json')
}

const { packageJson, path: packageJsonPath } = pkgJson
const hotHookConfig = packageJson.hotHook

await hot.init({
  root: hotHookConfig?.root ? resolve(packageJsonPath, hotHookConfig.root) : undefined,
  boundaries: hotHookConfig?.boundaries,
  ignore: ['**/node_modules/**'].concat(hotHookConfig?.ignore || []),
})
