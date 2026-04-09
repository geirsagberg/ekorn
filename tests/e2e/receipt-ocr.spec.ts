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
    await expect(page.getByTestId('ocr-line-item').first()).toBeVisible()
    await expect(page.getByTestId('ocr-error')).toHaveCount(0)
  })
})
