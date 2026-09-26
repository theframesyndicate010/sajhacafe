"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

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
  useEffect(() => {
    if (!order) return;
    const onAfterPrint = () => {
      void api.markBillPrinted(receiptId, order.updatedAt)
        .then(() => queryClient.invalidateQueries({ queryKey: ["bills"] }))
        .catch((error) => console.error("Unable to save printed bill status", error));
    };
    window.addEventListener("afterprint", onAfterPrint);
    const printTimer = isWaiter ? undefined : window.setTimeout(() => window.print(), 500);
    return () => {
      if (printTimer !== undefined) window.clearTimeout(printTimer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [isWaiter, order, queryClient, receiptId]);
  if (orderQuery.isLoading || settingsQuery.isLoading) return <section className="card"><p className="muted">Loading receipt…</p></section>;
  if (!order || orderQuery.error) return <section className="card"><h1 className="page-title">Bill not found</h1><p className="muted">This bill is not available in the active cafe.</p><Link className="btn" href={backPath}>{isWaiter ? "Back to bills" : "Back to POS"}</Link></section>;
  const payments = order.payments ?? [];
  const paid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  return (
    <main className="receipt-page">
      <div className="receipt-print-actions print-hidden"><Link className="btn secondary" href={backPath}>{backPath === "/pos" ? "Back to POS" : "Back to bills"}</Link>{isWaiter && order.status === "OPEN" && <button className="btn secondary" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate(order.id)} type="button">{closeMutation.isPending ? "Closing table…" : "Close table"}</button>}{isWaiter && order.status === "CLOSED" && <span className="muted">Table closed · ready for a new customer</span>}{pathname.startsWith("/cashier/") && order.status === "OPEN" && <Link className="btn secondary" href={`/cashier/pos?billId=${encodeURIComponent(order.id)}`}>Settle in POS</Link>}<button className="btn" onClick={() => window.print()} type="button">Print bill</button></div>
      {closeMutation.error && <p className="error print-hidden" role="alert">{closeMutation.error instanceof Error ? closeMutation.error.message : "Unable to close table."}</p>}
      <article className="receipt-paper">
        <header className="receipt-heading">{settings?.logo && <img alt={`${settings.businessName} logo`} height={72} src={settings.logo} width={72} />}<h1>{settings?.businessName ?? order.table?.tableNumber ?? "Cafe"}</h1>{settings?.address && <p>{settings.address}</p>}{(settings?.phone || settings?.email) && <p>{[settings.phone, settings.email].filter(Boolean).join(" · ")}</p>}<p>Bill #{order.billNumber}</p><small>{new Date(order.createdAt ?? Date.now()).toLocaleString()}</small></header>
        <div className="receipt-meta"><span>Bill</span><strong>{order.billNumber}</strong><span>Table</span><strong>{order.table?.tableNumber ?? "Takeaway"}</strong><span>Customer</span><strong>{order.customer?.name ?? "Walk-in customer"}</strong></div>
        <table className="receipt-items"><thead><tr><th>Item</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id}><td>{item.itemName}</td><td>{item.quantity}</td><td>NPR {Number(item.unitPrice).toLocaleString()}</td><td>NPR {Number(item.totalAmount).toLocaleString()}</td></tr>)}</tbody></table>
        <div className="receipt-totals"><div><span>Subtotal</span><span>NPR {Number(order.subtotal).toLocaleString()}</span></div><div><span>Tax</span><span>NPR {Number(order.taxAmount).toLocaleString()}</span></div><div className="receipt-grand-total"><strong>Total</strong><strong>NPR {Number(order.totalAmount).toLocaleString()}</strong></div>{payments.map((payment) => <div key={payment.id}><span>Payment ({payment.method}){payment.referenceNumber ? ` · ${payment.referenceNumber}` : ""}</span><span>NPR {Number(payment.amount).toLocaleString()}</span></div>)}{paid < Number(order.totalAmount) && <div className="receipt-due"><strong>Balance due</strong><strong>NPR {(Number(order.totalAmount) - paid).toLocaleString()}</strong></div>}</div>
        <footer className="receipt-footer">Thank you. We hope to see you again.</footer>
      </article>
    </main>
  );
}
