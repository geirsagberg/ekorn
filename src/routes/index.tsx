import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { analyzeReceiptPreview } from '#/features/receipt-ocr/analyze-receipt'
import { ReceiptApp } from '#/features/receipt-ocr/receipt-app'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const analyzeReceipt = useServerFn(analyzeReceiptPreview)

  return <ReceiptApp analyzeReceipt={analyzeReceipt} />
}
