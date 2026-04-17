# Ekorn

Receipt intelligence web app scaffolded with Bun, TanStack Start, React, TypeScript, TanStack Query, Convex, and Material UI.

## Getting Started

1. Install dependencies:

```sh
bun install
```

2. Start Convex in another terminal when ready to connect the backend:

```sh
bunx convex dev
```

3. Run the app:

```sh
bun run dev
```

## Receipt OCR

Receipt OCR preview defaults to OpenAI and can optionally use AWS.

Set these server-side environment variables before using the OCR flow:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional override
- `OCR_PROVIDER` optional, defaults to `openai`

If you want to use AWS instead:

- `OCR_PROVIDER=aws`
- `AWS_REGION` or `AWS_DEFAULT_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` if your credentials require it

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
- `bun run lint-staged` runs the staged-file pre-commit checks
