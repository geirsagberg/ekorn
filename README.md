# Ekorn

Receipt intelligence web app scaffolded with Bun, TanStack Start, React, TypeScript, TanStack Query, Convex, Material UI, and WorkOS AuthKit.

## Getting Started

1. Install dependencies:

```sh
bun install
```

2. Configure local environment variables:

```sh
cp .env.example .env.local
```

Fill in:

- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `ALLOWED_USER_EMAILS`
- `OPENAI_API_KEY`

3. Start Convex in another terminal when ready to connect the backend:

```sh
bunx convex dev
```

4. Run the app:

```sh
bun run dev
```

The app runs on `http://localhost:3000` and uses `http://localhost:3000/callback` for the WorkOS OAuth callback.

## Authentication

Ekorn is now a private single-user app:

- WorkOS AuthKit handles sign-in
- Convex validates WorkOS JWTs for all authenticated backend access
- `ALLOWED_USER_EMAILS` is the server-side allowlist gate

Set `ALLOWED_USER_EMAILS` in both:

- the TanStack Start/Netlify environment
- the Convex deployment environment

## Receipt Persistence

Saved receipts are now persisted in Convex instead of browser-only IndexedDB:

- receipt metadata and structured OCR results live in Convex tables
- original receipt images live in Convex file storage
- the browser IndexedDB layer remains local-only utility code and is no longer the source of truth for production history

## Receipt OCR

Receipt OCR preview uses OpenAI.

Set these server-side environment variables before using the OCR flow:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional override
- `OCR_PROVIDER` optional; if set, it must be `openai`

## Netlify Deployment

Use Netlify for the TanStack Start app and Convex for the backend:

1. Connect the repo in Netlify.
2. Set the build command to:

```sh
bunx convex deploy --cmd "bun run build"
```

3. Set production environment variables in Netlify:

- `CONVEX_DEPLOY_KEY`
- `WORKOS_CLIENT_ID`
- `WORKOS_API_KEY`
- `WORKOS_COOKIE_PASSWORD`
- `WORKOS_REDIRECT_URI`
- `ALLOWED_USER_EMAILS`
- `OPENAI_API_KEY`

4. Set the matching environment variables in the Convex production deployment:

- `WORKOS_CLIENT_ID`
- `ALLOWED_USER_EMAILS`

5. In WorkOS, configure the production callback URL as:

```text
https://<your-site>.netlify.app/callback
```

### Playwright Verification

Put your real receipt image here:

- `tests/fixtures/receipt.jpg`

Then run:

```sh
bunx playwright install chromium
bun run test:e2e
```

## Tooling

- `bun run build` builds the app
- `bun run check` runs Biome checks
- `bun run typecheck` runs the TypeScript compiler
- `bun run lint-staged` runs the staged-file pre-commit checks
