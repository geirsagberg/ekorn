import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import {
  AuthenticatedViewerStateProvider,
  type CurrentViewer,
  deriveAuthenticatedViewerState,
  useAuthenticatedViewerState,
} from './authenticated-viewer-state'
import type { ViewerSyncState } from './use-store-current-user-effect'

describe('deriveAuthenticatedViewerState', () => {
  it('returns loading while the viewer query is still unresolved', () => {
    expect(
      deriveAuthenticatedViewerState({
        syncState: {
          error: null,
          isLoading: false,
        },
        viewer: undefined,
      }),
    ).toEqual({
      kind: 'loading',
    })
  })

  it('returns ready when the viewer is allowed and sync is complete', () => {
    expect(
      deriveAuthenticatedViewerState({
        syncState: {
          error: null,
          isLoading: false,
        },
        viewer: createViewer(),
      }),
    ).toEqual({
      kind: 'ready',
      viewer: createViewer(),
    })
  })

  it('returns denied when the viewer is signed in but not allowlisted', () => {
    expect(
      deriveAuthenticatedViewerState({
        syncState: {
          error: null,
          isLoading: false,
        },
        viewer: createViewer({
          isAllowed: false,
        }),
      }),
    ).toEqual({
      kind: 'denied',
      viewer: createViewer({
        isAllowed: false,
      }),
    })
  })

  it('returns expired when auth is present but no current viewer can be resolved', () => {
    expect(
      deriveAuthenticatedViewerState({
        syncState: {
          error: null,
          isLoading: false,
        },
        viewer: null,
      }),
    ).toEqual({
      kind: 'expired',
    })
  })

  it('returns error when user sync fails', () => {
    expect(
      deriveAuthenticatedViewerState({
        syncState: {
          error: 'Could not finish loading your account.',
          isLoading: false,
        },
        viewer: createViewer(),
      }),
    ).toEqual({
      kind: 'error',
      message: 'Could not finish loading your account.',
    })
  })
})

describe('useAuthenticatedViewerState', () => {
  it('updates the atom-backed viewer contract when sync inputs change', async () => {
    const { rerender } = render(
      <AuthenticatedViewerStateProvider>
        <ViewerStateProbe
          syncState={{
            error: null,
            isLoading: true,
          }}
          viewer={undefined}
        />
      </AuthenticatedViewerStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('viewer-state').textContent).toBe('loading')
    })

    rerender(
      <AuthenticatedViewerStateProvider>
        <ViewerStateProbe
          syncState={{
            error: null,
            isLoading: false,
          }}
          viewer={createViewer()}
        />
      </AuthenticatedViewerStateProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('viewer-state').textContent).toBe('ready')
    })
  })
})

function ViewerStateProbe({
  syncState,
  viewer,
}: {
  syncState: ViewerSyncState
  viewer: CurrentViewer | null | undefined
}) {
  const viewerState = useAuthenticatedViewerState({
    syncState,
    viewer,
  })

  return <div data-testid="viewer-state">{viewerState.kind}</div>
}

function createViewer(overrides: Partial<CurrentViewer> = {}): CurrentViewer {
  return {
    allowlistConfigured: true,
    email: 'person@example.com',
    isAllowed: true,
    isStored: true,
    name: 'Example Person',
    ...overrides,
  }
}
