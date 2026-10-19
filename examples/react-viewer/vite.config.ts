import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rolldownOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        enginePart: fileURLToPath(new URL('./tests/fixtures/engine-part.html', import.meta.url)),
      },
    },
  },
})
