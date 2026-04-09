import { existsSync } from 'node:fs'
import path from 'node:path'
import { expect, test } from '@playwright/test'

const receiptFixturePath = path.resolve(
  process.cwd(),
  'tests/fixtures/receipt.jpg',
)

test.describe('receipt OCR', () => {
  test.skip(
    !existsSync(receiptFixturePath),
    'Place a local receipt image at tests/fixtures/receipt.jpg. This fixture stays untracked on purpose.',
  )

  test('extracts line items from a real receipt image', async ({ page }) => {
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
    await expect(page.getByText('Extracted lines')).toBeVisible({
      timeout: 60_000,
    })
    await expect(page.getByTestId('ocr-line-items')).toBeVisible()
    await expect(page.getByTestId('ocr-error')).toHaveCount(0)
    await expect(page.getByTestId('ocr-sanity-warning')).toHaveCount(0)

    const lineItems = page.getByTestId('ocr-line-item')
    const lineItemTexts = await lineItems.allTextContents()

    expect(lineItemTexts.length).toBeGreaterThan(0)

    const itemSum = lineItemTexts.reduce((sum, text) => {
      const amount = extractLastAmount(text)

      if (amount === null) {
        throw new Error(`Could not parse an item amount from: ${text}`)
      }

      return sum + amount
    }, 0)

    const summary = page.getByTestId('ocr-summary')
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
