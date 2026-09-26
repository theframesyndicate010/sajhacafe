"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { readPrinterConfig } from "@/lib/printing/config";
import { printerManager } from "@/lib/printing/printer-manager";
import { enqueuePrint } from "@/lib/printing/print-queue";
import { DEFAULT_PRINTER_CONFIG, toReceiptData } from "@/lib/printing/types";
import type { PrinterConfig, PrintState } from "@/lib/printing/types";

export function ReceiptPrint({ receiptId }: { receiptId: string }) {
  const pathname = usePathname();
  const isWaiter = pathname.startsWith("/waiter/");
  const backPath = pathname.startsWith("/waiter/") ? "/waiter/bills" : pathname.startsWith("/cashier/") ? "/cashier/bills" : "/pos";
  const router = useRouter();
  const queryClient = useQueryClient();
  const orderQuery = useQuery({ queryKey: ["bill", receiptId], queryFn: () => api.bill(receiptId) });
  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.settings.get });
  const order = orderQuery.data;
  const settings = settingsQuery.data;
  const closeMutation = useMutation({
    mutationFn: (billId: string) => api.closeBill(billId),
    onSuccess: (closedBill) => {
      queryClient.setQueryData(["bill", receiptId], closedBill);
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      router.refresh();
    },
  });
  const [printerConfig, setPrinterConfig] = useState<PrinterConfig | null>(null);
  const [thermalState, setThermalState] = useState<PrintState | null>(null);
  const [thermalError, setThermalError] = useState("");
  const [systemPrintError, setSystemPrintError] = useState("");
  useEffect(() => { setPrinterConfig(readPrinterConfig()); }, []);
  const updateThermalState = useCallback((state: PrintState, error?: string) => {
    setThermalState(state);
    setThermalError(error ?? "");
    if (state === "printed" && order) {
      void api.markBillPrinted(receiptId, order.updatedAt)
        .then(() => queryClient.invalidateQueries({ queryKey: ["bills"] }))
        .catch((reason) => console.error("Unable to save thermally printed bill status", reason));
    }
  }, [order, queryClient, receiptId]);
  const printSystemReceipt = async () => {
    if (!order) return;
    setSystemPrintError("");
    try {
      await printerManager.printReceipt(toReceiptData(order, settings), {
        ...(printerConfig ?? DEFAULT_PRINTER_CONFIG),
        connection: "BROWSER",
      }, () => {
        void api.markBillPrinted(receiptId, order.updatedAt)
          .then(() => queryClient.invalidateQueries({ queryKey: ["bills"] }))
          .catch((reason) => console.error("Unable to save printed bill status", reason));
      });
    } catch (reason) {
      setSystemPrintError(reason instanceof Error ? reason.message : "System Print failed.");
    }
  };
  if (orderQuery.isLoading || settingsQuery.isLoading) return <section className="card"><p className="muted">Loading receipt…</p></section>;
  if (!order || orderQuery.error) return <section className="card"><h1 className="page-title">Bill not found</h1><p className="muted">This bill is not available in the active cafe.</p><Link className="btn" href={backPath}>{isWaiter ? "Back to bills" : "Back to POS"}</Link></section>;
  const payments = order.payments ?? [];
  const paid = payments.filter(payment => !payment.status || payment.status === "COMPLETED").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const total = Number(order.totalAmount);
  const balance = Math.max(0, total - paid);
  const change = Math.max(0, paid - total);
  return (
    <main className="receipt-page" style={{ "--receipt-paper-width": `${printerConfig?.paperWidth ?? 58}mm` } as CSSProperties}>
      <div className="receipt-print-actions print-hidden"><Link className="btn secondary" href={backPath}>{backPath === "/pos" ? "Back to POS" : "Back to bills"}</Link>{isWaiter && order.status === "OPEN" && !order.tableClosedAt && <button className="btn secondary" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate(order.id)} type="button">{closeMutation.isPending ? "Closing table…" : "Close table"}</button>}{isWaiter && order.tableClosedAt && <span className="muted">Table closed · bill remains pending cashier checkout</span>}{isWaiter && order.status === "CLOSED" && <span className="muted">Bill settled</span>}{pathname.startsWith("/cashier/") && order.status === "OPEN" && <Link className="btn secondary" href={`/cashier/pos?billId=${encodeURIComponent(order.id)}`}>Settle in POS</Link>}<button className="btn secondary" onClick={() => void printSystemReceipt()} type="button">System Print</button><button className="btn" disabled={thermalState === "printing" || !printerConfig || printerConfig.connection === "BROWSER"} onClick={() => { if (!printerConfig) return; setThermalError(""); enqueuePrint(order.id, toReceiptData(order, settings), printerConfig, updateThermalState); }} type="button">{thermalState === "printing" ? "Printing…" : "Thermal Print"}</button></div>
      <p className="muted print-hidden">System Print opens the browser/OS dialog. Thermal Print sends ESC/POS through the selected printer connection.</p>
      {systemPrintError && <p className="error print-hidden" role="alert">{systemPrintError}</p>}
      {thermalState && <p className={thermalState === "failed" ? "error print-hidden" : "muted print-hidden"} role="status">{thermalState === "printed" ? "Print command sent. Confirm that paper came out." : thermalState === "failed" ? `Print failed. ${thermalError}` : "Sending to printer…"}{thermalState === "failed" && printerConfig && <button className="btn secondary" onClick={() => { setThermalError(""); enqueuePrint(`${order.id}:${Date.now()}`, toReceiptData(order, settings), printerConfig, updateThermalState); }} type="button">Retry Print</button>}</p>}
      {closeMutation.error && <p className="error print-hidden" role="alert">{closeMutation.error instanceof Error ? closeMutation.error.message : "Unable to close table."}</p>}
      <article className={`receipt-paper receipt-paper-${printerConfig?.paperWidth ?? 58}`}>
        <header className="receipt-heading">
          {settings?.logo && <img alt={`${settings.businessName} logo`} height={56} src={settings.logo} width={56} />}
          <h1>{settings?.businessName ?? "Cafe"}</h1>
          {settings?.address && <p>{settings.address}</p>}
          {(settings?.phone || settings?.email) && <p>{[settings.phone, settings.email].filter(Boolean).join(" · ")}</p>}
          {settings?.taxNumber && <p>VAT/PAN: {settings.taxNumber}</p>}
          <p>Bill #{order.billNumber}</p>
          <p>Order #{order.orderNumber}</p>
          <small>{new Date(order.createdAt ?? Date.now()).toLocaleString()}</small>
        </header>
        <div aria-hidden="true" className="receipt-separator receipt-separator-dashed" />
        <section aria-label="Bill information" className="receipt-meta">
          <div><span>Table:</span><strong>{order.tableNumber ?? order.table?.tableNumber ?? "Takeaway"}</strong></div>
          <div><span>Customer:</span><strong>{order.customer?.name ?? "Walk-in customer"}</strong></div>
        </section>
        <table className="receipt-items">
          <colgroup><col className="receipt-item-name-col" /><col className="receipt-item-qty-col" /><col className="receipt-item-price-col" /><col className="receipt-item-amount-col" /></colgroup>
          <thead><tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Unit price</th><th scope="col">Amount</th></tr></thead>
          <tbody>{order.items.map((item) => <tr key={item.id}><td>{item.itemName}</td><td>{item.quantity}</td><td>NPR {Number(item.unitPrice).toLocaleString()}</td><td>NPR {Number(item.totalAmount).toLocaleString()}</td></tr>)}</tbody>
        </table>
        <section aria-label="Bill summary" className="receipt-summary">
          <div><span>Subtotal</span><span>NPR {Number(order.subtotal).toLocaleString()}</span></div>
          <div><span>Discount</span><span>NPR {Number(order.discountAmount).toLocaleString()}</span></div>
          <div><span>Tax (included in price)</span><span>NPR {Number(order.taxAmount).toLocaleString()}</span></div>
        </section>
        <div aria-hidden="true" className="receipt-separator receipt-separator-dashed" />
        <section aria-label="Payment summary" className="receipt-payment-summary">
          <div className="receipt-grand-total"><strong>Total</strong><strong>NPR {total.toLocaleString()}</strong></div>
          {(order.payments ?? []).filter(payment => !payment.status || payment.status === "COMPLETED").map(payment => <div key={payment.id}><span>{payment.method === "CASH" ? "Cash received" : `Paid (${payment.method})`}</span><span>NPR {Number(payment.amount).toLocaleString()}</span></div>)}
          {paid === 0 && <div><span>Amount paid</span><span>NPR 0</span></div>}
          {balance > 0 ? <div className="receipt-due"><strong>Balance due</strong><strong>NPR {balance.toLocaleString()}</strong></div> : <div className="receipt-paid"><strong>Paid in full</strong><strong>NPR 0 balance</strong></div>}
          {change > 0 && <div><span>Change</span><span>NPR {change.toLocaleString()}</span></div>}
        </section>
        <footer className="receipt-footer">Thank you. We hope to see you again.</footer>
      </article>
    </main>
  );
}
