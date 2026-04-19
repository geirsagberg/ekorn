import { useMemo } from 'react'
import { ReceiptFlowApp } from './receipt-flow-app'
import {
  createIndexedDbReceiptFlowDataSource,
  useConvexReceiptFlowDataSource,
} from './receipt-flow-data-source'
import {
  indexedDbReceiptRepository,
  type ReceiptRepository,
} from './receipt-repository'
import type { AnalyzeReceiptFn } from './shared'

interface ReceiptAppProps {
  analyzeReceipt: AnalyzeReceiptFn
  receiptRepository?: ReceiptRepository
}

export function ReceiptApp({
  analyzeReceipt,
  receiptRepository = indexedDbReceiptRepository,
}: ReceiptAppProps) {
  const dataSource = useMemo(
    () => createIndexedDbReceiptFlowDataSource(receiptRepository),
    [receiptRepository],
  )

  return (
    <ReceiptFlowApp analyzeReceipt={analyzeReceipt} dataSource={dataSource} />
  )
}

export function CloudReceiptApp({
  analyzeReceipt,
}: {
  analyzeReceipt: AnalyzeReceiptFn
}) {
  const { dataSource, syncState } = useConvexReceiptFlowDataSource()

  return (
    <ReceiptFlowApp
      analyzeReceipt={analyzeReceipt}
      dataSource={dataSource}
      syncState={syncState}
    />
  )
}
