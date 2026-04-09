import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { analyzeReceiptPreview } from '#/features/receipt-ocr/analyze-receipt'
import { ReceiptCaptureScreen } from '#/features/receipt-ocr/receipt-capture-screen'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const analyzeReceipt = useServerFn(analyzeReceiptPreview)

  return <ReceiptCaptureScreen analyzeReceipt={analyzeReceipt} />
}
