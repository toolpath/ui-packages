import { format } from 'prettier'
import { expect, it } from 'vitest'
import config from '../src/prettier.js'

it('formats with single quotes, no semicolons and trailing commas', async () => {
  const formatted = await format('const values = ["a", "b"];\n', {
    ...config,
    parser: 'typescript',
  })
  expect(formatted).toBe("const values = ['a', 'b']\n")
})
