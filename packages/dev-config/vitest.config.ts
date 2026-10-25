import config from './dev.config.mjs'
import { createVitestConfig } from './dist/testing/vitest.js'

export default createVitestConfig(config, { project: 'dev-config', suite: 'unit' })
