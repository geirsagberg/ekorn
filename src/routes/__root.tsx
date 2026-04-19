import type { ConvexQueryClient } from '@convex-dev/react-query'
import CssBaseline from '@mui/material/CssBaseline'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { createServerFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import ConvexProvider from '../integrations/convex/provider'
import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

interface MyRouterContext {
  convexQueryClient: ConvexQueryClient | null
  queryClient: QueryClient
}

const fetchWorkosAuth = createServerFn({ method: 'GET' }).handler(async () => {
  const auth = await getAuth()
  const { user } = auth

  return {
    token: user ? auth.accessToken : null,
    userId: user?.id ?? null,
  }
})

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async (ctx) => {
    const { token } = await fetchWorkosAuth()

    if (token) {
      ctx.context.convexQueryClient?.serverHttpClient?.setAuth(token)
    }
  },
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
