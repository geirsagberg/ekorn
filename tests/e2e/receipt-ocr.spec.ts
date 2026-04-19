import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const receiptFixturePath = path.resolve(
  process.cwd(),
  'tests/fixtures/receipt.jpg',
)
const shouldRunAuthenticatedFixtureTest =
  process.env.E2E_AUTHENTICATED_RECEIPT === '1'

test.describe('receipt OCR', () => {
  test('boots into a top-level app state', async ({ page }) => {
    await page.goto('/')

    await expect(page.locator('body')).toContainText(
      /Sign in to Ekorn|Access is restricted|Convex is not configured|Capture/,
    )
  })

  test('captures a real receipt image through the authenticated cloud flow', async ({
    page,
  }) => {
    test.skip(
      !existsSync(receiptFixturePath) || !shouldRunAuthenticatedFixtureTest,
      'Set E2E_AUTHENTICATED_RECEIPT=1 to exercise the authenticated cloud flow with the tracked fixture at tests/fixtures/receipt.jpg.',
    )

    const uploadLogs: string[] = []

    page.on('console', (message) => {
      if (message.type() !== 'info') {
        return
      }

      const text = message.text()

      if (text.includes('[receipt-upload]')) {
        uploadLogs.push(text)
      }
    })

    await page.goto('/')
    await expect(page.getByTestId('receipt-capture-ready')).toBeAttached()

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Add photo' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(receiptFixturePath)

    await expect(page.getByText('receipt.jpg')).toBeVisible()
    await expect(page.getByText('Receipt detail')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByText('Structured receipt')).toBeVisible()
    await expect(page.getByTestId('receipt-line-items')).toBeVisible()
    await expect(page.getByTestId('ocr-error')).toHaveCount(0)
    await expect(page.getByTestId('receipt-sanity-warning')).toHaveCount(0)

    const lineItems = page.getByTestId('receipt-line-item')
    const lineItemTexts = await lineItems.allTextContents()

    expect(lineItemTexts.length).toBeGreaterThan(0)

    const itemSum = lineItemTexts.reduce((sum, text) => {
      const amount = extractLastAmount(text)

      if (amount === null) {
        throw new Error(`Could not parse an item amount from: ${text}`)
      }

      return sum + amount
    }, 0)

    const summary = page.getByTestId('receipt-summary')
    const summaryText = await summary.textContent()

    expect(summaryText).toBeTruthy()

    const totalAmount = extractLastAmount(summaryText)

    expect(totalAmount).not.toBeNull()
    if (totalAmount === null) {
      throw new Error('Could not parse the total amount from the summary.')
    }

    expect(Math.abs(itemSum - totalAmount)).toBeLessThanOrEqual(0.01)
    await expect(page.getByTestId('ocr-error')).toHaveCount(0)
    await expect
      .poll(() =>
        uploadLogs.find((entry) => entry.includes('[receipt-upload]')),
      )
      .toBeTruthy()
  })
})

function extractLastAmount(text: string | null) {
  if (!text) {
    return null
  }

  const matches = [...text.matchAll(/\d+[,.]\d{2}/g)]
  const lastMatch = matches.at(-1)?.[0]

  if (!lastMatch) {
    return null
  }

  return Number.parseFloat(lastMatch.replace(',', '.'))
}
