# PRD: Mobile Capture With Saved History

## Problem Statement

Ekorn can currently analyze a receipt on a single screen, but it still feels like a preview demo rather than a product someone would use every day.

The next iteration should make the app useful on the go: capture a receipt on mobile, wait for one clear processing flow, save successful receipts, and revisit them later without having to inspect the raw image by default.

## Solution

Turn the current preview flow into a simple three-screen mobile product:

- `Capture`
- `History`
- `Receipt detail`

Flow:

- The app opens on `Capture`.
- The user taps one button to add a receipt photo.
- The browser should handle camera or existing-photo choice when possible.
- The app shows one processing state while the full analysis runs.
- If processing succeeds, the receipt is saved and opened in `Receipt detail`.
- If processing fails, nothing is saved.

Saved receipts should be interpretation-first:

- `Receipt detail` shows structured receipt data first.
- The receipt image is available through an explicit `View receipt image` action.
- Receipts with low confidence or mismatched totals are saved with a `Needs review` status.

## User Stories

1. As a mobile user, I want to capture a receipt right after shopping, so that I can save it before I forget.
2. As a mobile user, I want one clear action to add a receipt photo, so that the app feels simple and fast.
3. As a mobile user, I want to see clear progress while the receipt is being processed, so that I know the app is working.
4. As a mobile user, I want successful captures to be saved automatically, so that I do not need an extra save step.
5. As a returning user, I want a history of saved receipts, so that the app is useful beyond the current session.
6. As a returning user, I want to open a receipt into structured detail first, so that I can review the interpreted result quickly.
7. As a cautious user, I want receipts with low confidence or mismatched totals to be marked `Needs review`, so that I know which receipts deserve attention.
8. As a cautious user, I want viewing the original image to be an explicit choice, so that I only inspect it when needed.

## Implementation Decisions

- Start with three screens: `Capture`, `History`, and `Receipt detail`.
- Default to `Capture` on app launch.
- Use bottom navigation for top-level mobile navigation.
- Keep one primary capture action instead of separate `Take photo` and `Choose photo` controls.
- Do not force direct camera capture by default; prefer the browser's native mobile chooser behavior.
- Treat the full current processing flow as the success gate.
- Save only successful receipts.
- Keep failed captures out of history.
- Persist both the original receipt image and the structured analysis result for successful receipts.
- Default `Receipt detail` to structured data, not the raw image.
- Mark receipts as `Needs review` when extraction confidence is low or totals do not match closely enough.
- Treat merchant as optional and show `Unknown merchant` when missing.
- Keep history rows minimal: merchant, capture time, total if known, and status.

## Testing Decisions

- Test user-visible behavior, not implementation details.
- Add tests for successful save-after-processing, failed capture behavior, and navigation to detail.
- Add tests for receipt status derivation, especially `Needs review`.
- Add tests for history rows and receipt detail rendering.
- Follow the existing style of UI behavior tests and isolated domain tests already used in the codebase.

## Backend Notes

- Use on-device storage for saved receipts in this phase to avoid adding authentication before the core capture loop is validated.
- Prefer IndexedDB-level storage for saved receipt records and image blobs rather than `localStorage`.
- Successful captures need a durable saved receipt record that can be listed in history and opened in detail.
- Each saved receipt should keep both the original image reference and the structured analysis result.
- The backend should persist enough receipt metadata for history rows and detail views, including status, totals, timestamps, and optional merchant.
- `Needs review` should be stored or derived consistently from the analysis result so the UI can query it simply.
- Failed capture attempts should not create saved receipt records.
- Keep OpenAI-backed receipt analysis and categorization in the existing server-side flow.
- Keep Convex focused on categorization knowledge and other app data, not model inference.
- Defer account-based cloud sync until a later phase; if cloud persistence becomes necessary, add it behind authentication rather than inventing anonymous multi-user storage.

## Out of Scope

- Manual editing of receipts or categories
- Mark-as-reviewed actions
- Search or filtering in history
- Analytics and dashboards
- Duplicate detection
- Authentication, cloud sync, and household features
- Background processing or async fallback paths

## Further Notes

- This should stay a small, elegant iteration.
- The main product bet is that one synchronous mobile processing flow is acceptable if it stays fast enough in real use.
- If the flow feels too slow later, simplify the critical path based on real usage before adding more architecture.
