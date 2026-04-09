import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import * as React from 'react'
import ConvexProvider from '../integrations/convex/provider'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Ekorn',
      },
      {
        name: 'description',
        content:
          'Receipt intelligence for structured item extraction and tag-based spending analysis.',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <div id="boot-loader" aria-hidden="true">
          <div id="boot-loader-content">
            <div id="boot-loader-spinner" />
            <div id="boot-loader-label">Loading Ekorn</div>
          </div>
        </div>
        <ConvexProvider>
          <BootLoaderCleanup />
          {children}
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
        </ConvexProvider>
        <Scripts />
      </body>
    </html>
  )
}

function BootLoaderCleanup() {
  React.useEffect(() => {
    const loader = document.getElementById('boot-loader')

    if (!loader) {
      return
    }

    loader.setAttribute('data-hidden', 'true')

    const timeoutId = window.setTimeout(() => {
      loader.remove()
    }, 180)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [])

  return null
}
