import { v } from 'convex/values'
import {
  authPolicyMessages,
  getAccessPolicy,
} from '../src/integrations/auth/server-access-policy'
import { internal } from './_generated/api'
import {
  type ActionCtx,
  action,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
  query,
} from './_generated/server'

const NOT_AUTHENTICATED_MESSAGE = authPolicyMessages.notAuthenticated
const NOT_AUTHORIZED_MESSAGE = authPolicyMessages.notAuthorized

export const current = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()

    if (!identity) {
      return null
    }

    const user = await getStoredCurrentUser(ctx)
    const email = getIdentityEmail(identity) ?? user?.email ?? null
    const name = getIdentityName(identity) ?? user?.name ?? null
    const accessPolicy = getAccessPolicy(email)

    return {
      email,
      name,
      isAllowed: accessPolicy.isAllowed,
      isStored: user !== null,
      allowlistConfigured: accessPolicy.allowlistConfigured,
    }
  },
})

export const syncCurrent = action({
  args: {},
  handler: async (ctx) => {
    const identity = await requireIdentity(ctx)
    const profile = await fetchWorkosUserProfile(identity.subject)
    const user: {
      _id: string
      isAllowed: boolean
    } = await ctx.runMutation(internal.users.upsertCurrentUserProfile, {
      email: profile.email,
      name: profile.name,
      tokenIdentifier: identity.tokenIdentifier,
    })

    return {
      userId: user._id,
      isAllowed: user.isAllowed,
    }
  },
})

export const upsertCurrentUserProfile = internalMutation({
  args: {
    email: v.union(v.string(), v.null()),
    name: v.union(v.string(), v.null()),
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    const existingUser = await ctx.db
      .query('users')
      .withIndex('by_token_identifier', (q) =>
        q.eq('tokenIdentifier', args.tokenIdentifier),
      )
      .unique()
    const nextUserFields = buildUserFields({
      email: args.email,
      name: args.name,
    })

    if (existingUser) {
      if (
        existingUser.email !== nextUserFields.email ||
        existingUser.name !== nextUserFields.name ||
        existingUser.isAllowed !== nextUserFields.isAllowed ||
        existingUser.lastSeenAt !== nextUserFields.lastSeenAt
      ) {
        await ctx.db.patch(existingUser._id, nextUserFields)
      }

      return {
        ...existingUser,
        ...nextUserFields,
      }
    }

    const userId = await ctx.db.insert('users', {
      tokenIdentifier: args.tokenIdentifier,
      ...nextUserFields,
    })

    return {
      _id: userId,
      _creationTime: Date.now(),
      tokenIdentifier: args.tokenIdentifier,
      ...nextUserFields,
    }
  },
})

export async function upsertCurrentUser(ctx: MutationCtx) {
  const identity = await requireIdentity(ctx)
  const existingUser = await getStoredCurrentUser(ctx)
  const nextUserFields = buildUserFields({
    email: getIdentityEmail(identity) ?? existingUser?.email ?? null,
    name: getIdentityName(identity) ?? existingUser?.name ?? null,
  })

  if (existingUser) {
    if (
      existingUser.email !== nextUserFields.email ||
      existingUser.name !== nextUserFields.name ||
      existingUser.isAllowed !== nextUserFields.isAllowed ||
      existingUser.lastSeenAt !== nextUserFields.lastSeenAt
    ) {
      await ctx.db.patch(existingUser._id, nextUserFields)
    }

    return {
      ...existingUser,
      ...nextUserFields,
    }
  }

  const userId = await ctx.db.insert('users', {
    tokenIdentifier: identity.tokenIdentifier,
    ...nextUserFields,
  })

  return {
    _id: userId,
    _creationTime: Date.now(),
    tokenIdentifier: identity.tokenIdentifier,
    ...nextUserFields,
  }
}

export async function requireAllowedCurrentUser(ctx: MutationCtx) {
  const user = await upsertCurrentUser(ctx)

  if (!user.isAllowed) {
    throw new Error(NOT_AUTHORIZED_MESSAGE)
  }

  return user
}

export async function getCurrentUserOrThrow(ctx: QueryCtx | MutationCtx) {
  const identity = await requireIdentity(ctx)
  const user = await getStoredCurrentUser(ctx)
  const email = user?.email ?? getIdentityEmail(identity) ?? null

  if (!user) {
    throw new Error('Your account is still syncing. Refresh and try again.')
  }

  if (!getAccessPolicy(email).isAllowed) {
    throw new Error(NOT_AUTHORIZED_MESSAGE)
  }

  if (user.tokenIdentifier !== identity.tokenIdentifier) {
    throw new Error(NOT_AUTHORIZED_MESSAGE)
  }

  return user
}

async function getStoredCurrentUser(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity()

  if (!identity) {
    return null
  }

  return await ctx.db
    .query('users')
    .withIndex('by_token_identifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()
}

async function requireIdentity(ctx: QueryCtx | MutationCtx | ActionCtx) {
  const identity = await ctx.auth.getUserIdentity()

  if (!identity) {
    throw new Error(NOT_AUTHENTICATED_MESSAGE)
  }

  return identity
}

function buildUserFields(identity: {
  email?: string | null
  name?: string | null
  [key: string]: unknown
}) {
  const email = getIdentityEmail(identity)
  const name = getIdentityName(identity)

  return {
    email,
    name,
    isAllowed: getAccessPolicy(email).isAllowed,
    lastSeenAt: new Date().toISOString(),
  }
}

async function fetchWorkosUserProfile(userId: string) {
  const apiKey = process.env.WORKOS_API_KEY

  if (!apiKey) {
    throw new Error('WORKOS_API_KEY is required to sync authenticated users.')
  }

  const response = await fetch(
    `https://api.workos.com/user_management/users/${userId}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  )

  if (!response.ok) {
    throw new Error(
      `Could not fetch the signed-in WorkOS user profile (${response.status}).`,
    )
  }

  const payload = (await response.json()) as {
    email?: string | null
    firstName?: string | null
    lastName?: string | null
  }
  const name = [payload.firstName, payload.lastName]
    .filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    .join(' ')

  return {
    email: payload.email ?? null,
    name: name.length > 0 ? name : null,
  }
}

function getIdentityEmail(identity: {
  email?: string | null
  [key: string]: unknown
}) {
  return firstString(identity, [
    'email',
    'properties.email',
    'user.email',
    'profile.email',
  ])
}

function getIdentityName(identity: {
  name?: string | null
  [key: string]: unknown
}) {
  return firstString(identity, [
    'name',
    'properties.name',
    'user.name',
    'profile.name',
    'properties.first_name',
  ])
}

function firstString(
  identity: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = identity[key]

    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return null
}
