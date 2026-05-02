# Agent Notes

- This repository uses Bun.
- Run tests with `bun run test`, which uses the repo's Vitest config; do not use raw `bun test` for the full suite.
- Build the app with TanStack Start, React, TypeScript, TanStack Query, and Convex.
- Use the latest stable versions of core dependencies at implementation time.
- Keep feature-specific requirements in `SPEC.md`; keep this file minimal.
- Update `SPEC.md` as part of feature work whenever behavior, scope, or requirements change.
- Prefer an incremental, mobile-first, minimal UI style: build one screen at a time, keep styling restrained and readable, avoid speculative pages or abstractions, and prefer Material UI over utility-class-heavy styling.
- Prefer plain React `useState` for strictly local UI state, and use `jotai` when client state is shared across modules or represents a workflow boundary. Avoid introducing heavier client-state libraries unless there is a clear need they uniquely satisfy.
- When running the app locally, prefer local environment values from `.env.local` and related local env files only. Do not rely on, inherit, or silently load linked Netlify cloud environment values for local development unless the user explicitly asks for that behavior.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
