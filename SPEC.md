# Ekorn — Current Product Spec

## Summary
Ekorn is a mobile-first web app for capturing grocery receipts and turning them into structured receipt data that can be saved and revisited later.

The current product slice is a small three-screen mobile flow:
- `Capture`
- `History`
- `Receipt detail`

## Current Goal
The current goal is a useful mobile capture loop that is deployable for one real user, not just a preview demo.

The app should open on `Capture`, let the user add one receipt photo, show one clear processing state while the full analysis runs, automatically save successful receipts on-device, and open the saved result in `Receipt detail`.

The app should also keep a cloud-backed `History` of successful receipts so the user can revisit structured receipt data across sessions and devices without defaulting to the raw image.

When a receipt is captured in a foreign currency, the app should also try to convert it into the app's home currency using the receipt purchase date when available.

## Current Slice Scope

### In Scope Now
- A web app built with Bun, TanStack Start, React, TypeScript, TanStack Query, Convex, and Material UI.
- A mobile-first app shell with bottom navigation for top-level navigation.
- A default `Capture` screen on app launch.
- One primary capture action that uses the browser's native camera-or-gallery chooser behavior when available.
- Selected-photo preview during capture.
- One processing state while OCR and categorization complete.
- Automatic save after successful processing.
- No save when processing fails.
- Required authentication before using the app.
- Single-user allowlist protection so only the configured account can use the deployed app.
- Cloud-backed persistence for saved receipts in Convex.
- Durable storage of both the original receipt image and the structured analysis result for successful captures in Convex file storage and Convex tables.
- Optional browser-local caching is allowed, but it is not the source of truth for saved receipts.
- Local historical FX conversion for foreign-currency receipts using purchase date when available and capture date as a fallback.
- Local caching of historical FX lookups so recent conversions can be reused without another network request.
- A `History` screen with minimal rows showing merchant, capture time, total when known, and status.
- A `Receipt detail` screen that shows structured receipt data first.
- An explicit `View receipt image` action before showing the raw receipt image.
- A `Delete receipt` action in `Receipt detail` for local testing and iteration.
- `Needs review` status when totals do not match closely enough or categorization confidence is low.
- `Unknown merchant` as the fallback label when merchant extraction is missing.
- Existing server-side OCR and categorization flow for receipt analysis.
- Convex-backed taxonomy storage and learned categorization mappings.
- Deleting a saved receipt removes only the saved receipt record and image, while learned categorization data remains available for later captures.

### Explicitly Out of Scope For Now
- Manual editing of receipts or categories.
- Mark-as-reviewed actions.
- Search or filtering in history.
- Duplicate detection or merge flows for repeated captures of the same receipt.
- Shared household access.
- Manual FX overrides or exchange-rate editing.
- User-configurable home-currency settings.
- PDF upload.
- Background processing or asynchronous fallback paths.
- Spending dashboards and multi-receipt analytics.
- Admin tooling.

## Primary User Stories
- As a mobile user, I want to capture a receipt right after shopping so that I can save it before I forget.
- As a mobile user, I want one clear action to add a receipt photo so that the app feels simple and fast.
- As a mobile user, I want to see clear progress while the receipt is being processed so that I know the app is working.
- As a returning user, I want saved receipt history so that the app is useful beyond the current session.
- As the only authorized user, I want the deployed app locked behind safe sign-in so that my receipts stay private on a public URL.
- As a cautious user, I want receipts that look uncertain to be marked `Needs review` so that I know which ones deserve attention.
- As a traveler, I want foreign-currency receipts converted into my home currency using the purchase date so that saved totals are easier to understand later.

## Screen Requirements

### Capture
- Opens by default on app launch.
- Shows one obvious primary action to add a receipt photo.
- Lets the browser handle camera or existing-photo choice when possible.
- Shows the selected receipt image before or during processing.
- Shows one clear processing state for the full analysis flow.
- If processing succeeds, saves the receipt automatically and opens `Receipt detail`.
- If processing fails, shows a retryable error and does not create a saved receipt.
- Requires the user to be authenticated before the capture flow is available.

### History
- Lists successful saved receipts only.
- Keeps rows minimal and easy to scan on mobile.
- Shows merchant, capture time, total if known, and status.
- Shows the home-currency total for converted foreign receipts and keeps the original amount as supporting text.
- Loads from the authenticated user's cloud-backed receipt history.
- Opens a saved receipt into `Receipt detail`.

### Receipt Detail
- Defaults to structured receipt data, not the raw image.
- Shows extracted line items, categories, and summary totals when available.
- Lets the user tap a line item to inspect that item's amount, categories, confidence, and review status.
- Shows `Needs review` status when the saved result is uncertain.
- Shows original totals and, when available, a home-currency conversion summary with a short note about the historical FX rate used.
- Reveals the original receipt image only after an explicit user action.
- Supports deleting the current saved receipt without clearing learned categorization knowledge.
- Works across browser restarts and across signed-in devices for the same user.

## UX Principles For This Phase
- Mobile first.
- Keep the flow small and obvious.
- Prefer one synchronous capture-to-save loop over branching workflows.
- Favor structured interpretation over raw image inspection.
- Keep history useful without adding dashboard complexity.
- Prefer restrained, readable UI over speculative features.

## Technical Direction For This Phase
- Package manager/runtime: Bun.
- App framework: TanStack Start in SPA mode.
- UI: React + TypeScript + Material UI.
- Data fetching and cache sync: TanStack Query.
- Backend: Convex for taxonomy storage and learned categorization mappings.
- Authentication: WorkOS AuthKit for sign-in, bridged into Convex auth.
- Receipt persistence: Convex tables plus Convex file storage.
- Historical FX conversion: Frankfurter API transport pinned to ECB provider, with local IndexedDB caching and `NOK` as the default home currency.
- OCR preview uses OpenAI through the existing provider facade.
- Categorization runs after OCR preview and reuses persistent cache entries before calling AI.
- Deployment target: Netlify for the TanStack Start app and Convex for backend/data.
- Use the latest stable versions available at implementation time for core dependencies.

## Deferred Product Vision
These remain part of the broader product direction:
- Receipt correction and review workflows beyond status flags.
- Search and richer history tools.
- Duplicate detection for repeated captures, reprocessed images, and near-identical saved receipts.
- Household-aware data and sharing.
- Spending dashboards and analytics.
- Admin and audit views.

## Success Criteria For The Current Slice
- The app opens on `Capture`.
- The user can add a receipt photo with one clear action.
- The browser can offer camera or gallery selection where supported.
- The app shows one clear processing state while analysis runs.
- Successful processing automatically saves the receipt locally.
- Successful processing automatically saves the receipt to the authenticated user's cloud history.
- Failed processing does not create a saved receipt.
- Successful captures open directly in `Receipt detail`.
- `History` shows previously saved receipts.
- Unauthenticated visitors cannot access receipt history or capture.
- Signed-in users not on the allowlist cannot access receipt history or capture.
- Foreign-currency receipts are converted into `NOK` when a historical rate is available.
- If purchase date is missing, the app falls back to capture date and labels the conversion basis accordingly.
- If the FX lookup fails, the app reuses the newest cached historical rate on or before the requested date when possible.
- `Receipt detail` leads with structured data and keeps image viewing explicit.
- Deleting a receipt removes it from history without clearing reusable categorization mappings.
- Receipts with low-confidence extraction or mismatched totals are marked `Needs review`.
- The overall experience feels clean, mobile-first, and useful beyond a single session.
