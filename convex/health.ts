import { query } from './_generated/server'

export const status = query({
  args: {},
  handler: async () => ({
    ok: true,
    service: 'ekorn',
    timestamp: Date.now(),
  }),
})
