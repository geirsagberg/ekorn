import { isAllowedUserEmail, parseAllowedUserEmails } from './access-control'

export const authPolicyMessages = {
  notAuthenticated: 'Not authenticated.',
  notAuthorized: 'This account is not allowed to use Ekorn.',
  receiptProcessingRequiresSignIn: 'Sign in before processing receipts.',
  receiptProcessingNotAllowed:
    'This account is not allowed to process receipts.',
} as const

export function resolveAllowedUserEmails(
  value: string | null | undefined = process.env.ALLOWED_USER_EMAILS,
) {
  return parseAllowedUserEmails(value)
}

export function getAccessPolicy(
  email: string | null | undefined,
  allowedUserEmailsValue?: string | null | undefined,
) {
  const allowedEmails = resolveAllowedUserEmails(allowedUserEmailsValue)

  return {
    allowedEmails,
    allowlistConfigured: allowedEmails.length > 0,
    isAllowed: isAllowedUserEmail(email, allowedEmails),
  }
}

export function requireAuthenticatedValue<T>(
  value: T | null | undefined,
  message: string = authPolicyMessages.notAuthenticated,
) {
  if (value === null || value === undefined) {
    throw new Error(message)
  }

  return value
}

export function requireAllowlistedEmail(
  email: string | null | undefined,
  options: {
    allowedUserEmailsValue?: string | null | undefined
    notAllowedMessage?: string
  } = {},
) {
  const accessPolicy = getAccessPolicy(email, options.allowedUserEmailsValue)

  if (!accessPolicy.isAllowed) {
    throw new Error(
      options.notAllowedMessage ?? authPolicyMessages.notAuthorized,
    )
  }

  return accessPolicy
}
