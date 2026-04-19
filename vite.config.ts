/// <reference types="vitest/config" />

import netlify from '@netlify/vite-plugin-tanstack-start'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const config = defineConfig({
  plugins: [
    devtools({
      consolePiping: {
        enabled: false,
      },
    }),
    tanstackStart(),
    netlify(),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: ['tests/e2e/**'],
  },
})

export default config
