import { atom, Provider, useAtomValue, useSetAtom } from 'jotai'
import { type ReactNode, useEffect } from 'react'
import type { ViewerSyncState } from './use-store-current-user-effect'

export interface CurrentViewer {
  allowlistConfigured: boolean
  email: string | null
  isAllowed: boolean
  isStored: boolean
  name: string | null
}

type CurrentViewerQueryResult = CurrentViewer | null | undefined
type DeniedViewer = Omit<CurrentViewer, 'isAllowed'> & { isAllowed: false }
type ReadyViewer = Omit<CurrentViewer, 'isAllowed'> & { isAllowed: true }

export type AuthenticatedViewerState =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'expired' }
  | { kind: 'denied'; viewer: DeniedViewer }
  | { kind: 'ready'; viewer: ReadyViewer }

interface AuthenticatedViewerInputs {
  syncState: ViewerSyncState
  viewer: CurrentViewerQueryResult
}

const currentViewerAtom = atom<CurrentViewerQueryResult>(undefined)
const viewerSyncAtom = atom<ViewerSyncState>({
  error: null,
  isLoading: true,
})

const authenticatedViewerStateAtom = atom((get) =>
  deriveAuthenticatedViewerState({
    syncState: get(viewerSyncAtom),
    viewer: get(currentViewerAtom),
  }),
)

const setAuthenticatedViewerInputsAtom = atom(
  null,
  (_get, set, inputs: AuthenticatedViewerInputs) => {
    set(currentViewerAtom, inputs.viewer)
    set(viewerSyncAtom, inputs.syncState)
  },
)

export function AuthenticatedViewerStateProvider({
  children,
}: {
  children: ReactNode
}) {
  return <Provider>{children}</Provider>
}

export function useAuthenticatedViewerState(inputs: AuthenticatedViewerInputs) {
  const setInputs = useSetAtom(setAuthenticatedViewerInputsAtom)
  const viewerState = useAtomValue(authenticatedViewerStateAtom)
  const viewerPresence =
    inputs.viewer === undefined
      ? 'missing'
      : inputs.viewer === null
        ? 'expired'
        : 'resolved'
  const resolvedViewer =
    viewerPresence === 'resolved' && inputs.viewer ? inputs.viewer : null

  useEffect(() => {
    setInputs({
      syncState: {
        error: inputs.syncState.error,
        isLoading: inputs.syncState.isLoading,
      },
      viewer: resolvedViewer
        ? {
            allowlistConfigured: resolvedViewer.allowlistConfigured,
            email: resolvedViewer.email,
            isAllowed: resolvedViewer.isAllowed,
            isStored: resolvedViewer.isStored,
            name: resolvedViewer.name,
          }
        : viewerPresence === 'expired'
          ? null
          : undefined,
    })
  }, [
    inputs.syncState.error,
    inputs.syncState.isLoading,
    resolvedViewer,
    setInputs,
    viewerPresence,
  ])

  return viewerState
}

export function deriveAuthenticatedViewerState({
  syncState,
  viewer,
}: AuthenticatedViewerInputs): AuthenticatedViewerState {
  if (syncState.error) {
    return {
      kind: 'error',
      message: syncState.error,
    }
  }

  if (syncState.isLoading || viewer === undefined) {
    return {
      kind: 'loading',
    }
  }

  if (!viewer) {
    return {
      kind: 'expired',
    }
  }

  if (!viewer.isAllowed) {
    return {
      kind: 'denied',
      viewer: {
        ...viewer,
        isAllowed: false,
      },
    }
  }

  return {
    kind: 'ready',
    viewer: {
      ...viewer,
      isAllowed: true,
    },
  }
}
