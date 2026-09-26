import type { Bill, RestaurantSettings } from "@/lib/api/client";

export type PrinterConnection = "USB" | "LOCAL_USB" | "BLUETOOTH" | "WEB_BLUETOOTH" | "WEB_SERIAL" | "NETWORK" | "BROWSER";
export type PrinterConfig = {
  id: string; name: string; model: string; connection: PrinterConnection;
  paperWidth: 58 | 80; autoPrint: boolean; copies: number; encoding: "utf-8" | "ascii";
  endpoint: string; token: string;
};
export type ReceiptData = {
  businessName: string; address?: string; contact?: string; taxNumber?: string; table?: string; logo?: string; logoRaster?: { width: number; height: number; dataBase64: string }; billNumber: string; orderNumber?: string; date: string; dateText?: string;
  cashier?: string; customer?: string;
  items: { name: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number; discount: number; tax: number; taxLabel?: string; total: number; paid: number; change: number; balance: number; payments: { method: string; amount: number; reference?: string }[]; footer: string;
};
export type PrintState = "printing" | "printed" | "failed";
export const DEFAULT_PRINTER_CONFIG: PrinterConfig = { id: "default", name: "XP-C2008", model: "XP-C2008", connection: "USB", paperWidth: 58, autoPrint: false, copies: 1, encoding: "ascii", endpoint: "http://127.0.0.1:17891", token: "" };
export function toReceiptData(bill: Bill, settings?: RestaurantSettings): ReceiptData {
  const paid = (bill.payments ?? []).filter(p => !p.status || p.status === "COMPLETED").reduce((sum,p) => sum + Number(p.amount), 0);
  return { businessName: settings?.businessName ?? "Cafe", address: settings?.address ?? undefined, contact: [settings?.phone, settings?.email].filter(Boolean).join(" / ") || undefined, taxNumber: settings?.taxNumber ?? undefined, table: bill.tableNumber ?? bill.table?.tableNumber ?? "Takeaway", logo: settings?.logo ?? undefined, billNumber: bill.billNumber, orderNumber: bill.orderNumber, date: bill.createdAt, dateText: new Date(bill.createdAt).toLocaleString(), customer: bill.customer?.name ?? "Walk-in customer", items: bill.items.map(i => ({ name: i.itemName, qty: Number(i.quantity), unitPrice: Number(i.unitPrice), total: Number(i.totalAmount) })), subtotal: Number(bill.subtotal), discount: Number(bill.discountAmount), tax: Number(bill.taxAmount), taxLabel: "Tax (included in price)", total: Number(bill.totalAmount), paid, change: Math.max(0, paid - Number(bill.totalAmount)), balance: Math.max(0, Number(bill.totalAmount) - paid), payments: (bill.payments ?? []).filter(p => !p.status || p.status === "COMPLETED").map(p => ({ method: p.method, amount: Number(p.amount), reference: p.referenceNumber ?? undefined })), footer: "Thank you. We hope to see you again." };
}
