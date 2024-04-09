import { resolve } from 'node:path'
import { hot } from './hot.js'
import { readPackageUp } from 'read-package-up'

const pkgJson = await readPackageUp()
if (!pkgJson) {
  throw new Error('Could not find package.json')
}

const { packageJson, path: packageJsonPath } = pkgJson
const hotHookConfig = packageJson['hot-hook']

await hot.init({
  root: hotHookConfig?.root ? resolve(packageJsonPath, packageJson['hot-hook'].root) : undefined,
  boundaries: packageJson['hot-hook']?.boundaries,
  ignore: ['**/node_modules/**'].concat(packageJson['hot-hook']?.ignore || []),
})
