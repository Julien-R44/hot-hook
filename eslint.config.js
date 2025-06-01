import { julr } from '@julr/tooling-configs/eslint'

export default await julr({
  ignores: ['./packages/hot_hook/tmp/**/*'],
})
