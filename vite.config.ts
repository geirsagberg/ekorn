/// <reference types="vitest/config" />

import netlify from '@netlify/vite-plugin-tanstack-start'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

const config = defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  const allowNetlifyCloudEnvInDev =
    environment.NETLIFY_CLOUD_ENV_IN_DEV?.trim().toLowerCase() === '1' ||
    environment.NETLIFY_CLOUD_ENV_IN_DEV?.trim().toLowerCase() === 'true'

  return {
    plugins: [
      devtools({
        consolePiping: {
          enabled: false,
        },
      }),
      tanstackStart(),
      netlify({
        dev: {
          environmentVariables: {
            enabled: allowNetlifyCloudEnvInDev,
          },
        },
      }),
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
  }
})

export default config
