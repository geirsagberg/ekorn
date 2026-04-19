export function parseAllowedUserEmails(value: string | null | undefined) {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((email) => normalizeEmail(email))
        .filter((email): email is string => email !== null),
    ),
  ]
}

export function normalizeEmail(email: string | null | undefined) {
  const normalizedEmail = email?.trim().toLowerCase() ?? ''

  return normalizedEmail.length > 0 ? normalizedEmail : null
}

export function isAllowedUserEmail(
  email: string | null | undefined,
  allowedEmails: string[],
) {
  const normalizedEmail = normalizeEmail(email)

  if (!normalizedEmail || allowedEmails.length === 0) {
    return false
  }

  return allowedEmails.includes(normalizedEmail)
}
