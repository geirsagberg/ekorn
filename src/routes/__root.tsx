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
