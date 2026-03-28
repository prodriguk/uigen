import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    environmentMatchGlobs: [
      ['src/lib/__tests__/**', 'node'],
      ['src/actions/**/__tests__/**', 'node'],
    ],
  },
})