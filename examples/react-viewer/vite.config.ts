import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        collection: fileURLToPath(new URL('./tests/fixtures/collection.html', import.meta.url)),
        enginePart: fileURLToPath(new URL('./tests/fixtures/engine-part.html', import.meta.url)),
        fileMesh: fileURLToPath(new URL('./tests/fixtures/file-mesh.html', import.meta.url)),
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
