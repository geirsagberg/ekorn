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
    'Place a real receipt image at tests/fixtures/receipt.jpg',
  )

  test('extracts line items from a real receipt image', async ({ page }) => {
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

    await expect(lineItems).toHaveCount(2)
    await expect(lineItems.nth(0)).toContainText(
      /Sylte i skiver.*80[,.]56|80[,.]56.*Sylte i skiver/,
    )
    await expect(lineItems.nth(1)).toContainText(
      /Spekeskinke i skiver.*77[,.]99|77[,.]99.*Spekeskinke i skiver/,
    )

    const summary = page.getByTestId('ocr-summary')

    await expect(summary).toContainText(
      /Subtotal.*158[,.]55|158[,.]55.*Subtotal/,
    )
    await expect(summary).toContainText(/Total.*158[,.]55|158[,.]55.*Total/)
    await expect(page.getByTestId('ocr-error')).toHaveCount(0)
  })
})
