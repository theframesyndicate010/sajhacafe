import { ReceiptPrint } from "@/components/pos/receipt-print";

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptPrint receiptId={id} />;
}
