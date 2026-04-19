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

Receipt OCR preview uses OpenAI.

Set these server-side environment variables before using the OCR flow:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` optional override
- `OCR_PROVIDER` optional; if set, it must be `openai`

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
