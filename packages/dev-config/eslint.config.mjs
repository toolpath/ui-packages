import config from './dev.config.mjs'
import { createEslintConfig } from './dist/eslint/index.js'

export default await createEslintConfig(config)
