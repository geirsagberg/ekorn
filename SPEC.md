# Ekorn — Current Product Spec

## Summary
Ekorn is a mobile-first web app for capturing grocery receipts and turning them into structured receipt data.

The current product slice is a receipt OCR and AI-assisted categorization preview flow on a single mobile-first capture screen, while longer-term spending analysis and richer receipt management remain ahead.

## Current Goal
The current goal is a single mobile-first receipt capture and preview screen with one clear primary action: add a receipt photo.

That action should let the user choose a photo from:
- the camera
- the photo gallery or file picker

After selection, the app should:
- show the selected receipt image on the same screen
- run OCR analysis on the uploaded image
- show extracted line items and summary totals when available
- show suggested categories for extracted receipt lines when categorization succeeds
- show clear loading, warning, and failure states

This slice is intentionally narrow. It focuses on the app shell, mobile interaction model, image upload flow, OCR preview, and preview-time learned categorization, with receipt persistence, history, review workflows, and dashboards planned separately.

## Current Slice Scope

### In Scope Now
- A web app built with Bun, TanStack Start, React, TypeScript, TanStack Query, Convex, and Material UI.
- A single mobile-first screen.
- One primary button for adding a receipt photo.
- Browser support for taking a photo with the device camera when available.
- Browser support for selecting an existing image from the gallery or file picker.
- Clear empty-state UI focused on the first receipt.
- Selected-photo preview on the same screen.
- Basic client-side receipt image validation, including image-only uploads and file-size limits.
- Receipt OCR preview on upload.
- Extracted line items display.
- AI-assisted receipt-line categorization during preview.
- Category chips and confidence display for categorized line items.
- Deterministic line-label normalization for categorization cache keys.
- Persistent learned mappings for raw labels and normalized labels through Convex.
- Seeded grocery taxonomy with system-generated extension when no existing path fits.
- Extracted subtotal and total display when present.
- Sanity-check warnings when extracted line items do not match receipt totals closely enough.
- Retryable error states when OCR fails.

### Explicitly Out of Scope For Now
- Persisting uploaded receipt assets.
- Receipt list pages or history views.
- Receipt detail pages beyond the current capture-and-preview screen.
- Structured receipt review and correction flows.
- User-managed category editing or override flows.
- Household-specific categorization or taxonomy overrides.
- Spending dashboards and summaries across multiple receipts.
- Duplicate detection.
- Authentication.
- Shared household access.
- PDF upload.
- Admin tooling.
- Background jobs or processing pipelines.

## Primary User Story
As a user on my phone, I want to tap one button and add a receipt photo from the camera or gallery so that I can quickly capture a receipt right after shopping and immediately preview what the app extracted and how it was categorized.

## Screen Requirements

### Layout
- Design for mobile first.
- The screen should work comfortably one-handed on a phone.
- The primary action should be obvious without scrolling.
- The screen should start simple and avoid secondary navigation for now.

### Interaction
- Provide one primary button for adding a photo.
- The implementation may use one native file input with camera-friendly attributes if that is the simplest and most reliable approach.
- If the platform supports it, the flow should make it easy to capture directly from the camera.
- If the user does not want to use the camera, the same flow should allow choosing an existing photo.
- After a photo is selected, the same screen should present the preview and OCR result without navigating away.

### States
- Initial empty state.
- Picking state if needed.
- Selected-photo state.
- OCR analyzing state.
- Success state with extracted receipt data and category suggestions.
- Warning state when the OCR result is usable but needs review.
- Error state for invalid files or failed OCR analysis.

## UX Principles For This Phase
- Mobile first.
- One screen, one primary action.
- No dashboard thinking yet.
- No speculative complexity.
- Prefer reliable browser behavior over clever UI.
- Prefer a useful preview over premature workflow branching.
- Show category suggestions as lightweight guidance, not as a full review workflow.

## Technical Direction For This Phase
- Package manager/runtime: Bun.
- App framework: TanStack Start in SPA mode.
- UI: React + TypeScript.
- Data fetching and cache sync: TanStack Query.
- Backend: Convex for taxonomy storage and learned categorization mappings.
- OCR preview runs through pluggable providers.
- Categorization runs after OCR preview and reuses persistent cache entries before calling AI.
- Category taxonomy is global, English, and seeded with core grocery branches.
- Use the latest stable versions available at implementation time for core dependencies.

## Deferred Product Vision
These remain part of the broader product direction:
- Persisted receipt storage.
- Receipt history.
- Structured receipt review and correction.
- Spending dashboards.
- Richer taxonomy curation, overrides, and rollups.
- Duplicate detection.
- Authentication and household sharing.
- Admin and audit views.

## Likely Next Phases
1. Persist the selected receipt asset.
2. Add basic receipt history.
3. Add structured receipt review, correction, and category override workflows.
4. Add household-aware taxonomy and learned mapping management.
5. Add multi-receipt spending views and summaries.

## Success Criteria For The Current Slice
- The app opens to a single mobile-first screen.
- The user can tap one clear button to add a receipt photo.
- On supported devices, the flow can use the camera.
- The same flow also supports choosing an existing image.
- The selected image is shown on the same screen.
- OCR analysis starts automatically after image selection.
- Extracted items and summary totals are shown when parsing succeeds.
- Category suggestions are shown for receipt lines when categorization succeeds.
- Learned categorization reuse reduces repeated AI work for duplicate or normalized line labels.
- The app shows clear warning and error feedback when analysis is incomplete or fails.
- The experience feels clean and obvious on a phone.
