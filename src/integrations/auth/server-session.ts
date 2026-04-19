export interface ServerSessionState {
  isAuthenticated: boolean
  token: string | null
  userId: string | null
}

export function createServerSessionState(auth: {
  accessToken?: string | null
  user?: {
    id?: string | null
  } | null
}): ServerSessionState {
  return {
    isAuthenticated: auth.user !== null && auth.user !== undefined,
    token: auth.user ? (auth.accessToken ?? null) : null,
    userId: auth.user?.id ?? null,
  }
}
