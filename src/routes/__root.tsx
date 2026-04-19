import CssBaseline from '@mui/material/CssBaseline'
import { TanStackDevtools } from '@tanstack/react-devtools'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import { ServiceWorkerRegistration } from '#/integrations/pwa/service-worker-registration'
import { createServerSessionState } from '../integrations/auth/server-session'
import ConvexProvider from '../integrations/convex/provider'
import { syncServerSessionToConvexQueryClient } from '../integrations/convex/server-auth'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import type { AppRouterContext } from '../integrations/tanstack-query/root-provider'

const fetchServerSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const auth = await getAuth()

    return createServerSessionState(auth)
  },
)

export const Route = createRootRouteWithContext<AppRouterContext>()({
  beforeLoad: async (ctx) => {
    const session = await fetchServerSession()

    syncServerSessionToConvexQueryClient(ctx.context.convexQueryClient, session)
  },
  head: () => ({
    links: [
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
    ],
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      {
        title: 'Ekorn',
      },
      {
        name: 'description',
        content:
          'Receipt intelligence for structured item extraction and tag-based spending analysis.',
      },
      {
        name: 'theme-color',
        content: '#2f7d57',
      },
      {
        name: 'mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-capable',
        content: 'yes',
      },
      {
        name: 'apple-mobile-web-app-title',
        content: 'Ekorn',
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
        <ConvexProvider>
          <CssBaseline />
          <ServiceWorkerRegistration />
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
