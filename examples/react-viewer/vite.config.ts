import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        enginePart: fileURLToPath(new URL('./tests/fixtures/engine-part.html', import.meta.url)),
        explodePolicy: fileURLToPath(
          new URL('./tests/fixtures/explode-policy.html', import.meta.url),
        ),
        explodePrimitives: fileURLToPath(
          new URL('./tests/fixtures/explode-primitives.html', import.meta.url),
        ),
      },
    },
  },
})
