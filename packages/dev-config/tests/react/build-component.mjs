// Builds one component module for the DOM behaviour test, in plain Node: esbuild
// refuses to run inside the jsdom environment, whose TextEncoder is jsdom's.
//
// Usage: node build-component.mjs <project-directory> <filename> compiled|uncompiled < source
import { readFileSync } from 'node:fs'
import { transform } from 'esbuild'
import { compileModule, compilerOptionsFor } from '../../dist/react/compiler.js'

const [directory = '', filename = '', variant = ''] = process.argv.slice(2)
const source = readFileSync(0, 'utf8')
const input =
  variant === 'compiled'
    ? (await compileModule(source, { filename, directory, options: compilerOptionsFor('19') })).code
    : source
const { code } = await transform(input, { loader: 'tsx', jsx: 'automatic', format: 'esm' })
process.stdout.write(code)
