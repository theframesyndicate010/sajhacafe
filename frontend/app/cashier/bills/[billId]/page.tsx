import { ReceiptPrint } from "@/components/pos/receipt-print";

export default async function CashierBillDetailPage({ params }: { params: Promise<{ billId: string }> }) {
  const { billId } = await params;
  return <ReceiptPrint receiptId={billId} />;
}
