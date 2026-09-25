"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Bill } from "@/lib/api/client";

export default function WaiterBillsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["bills"], queryFn: () => api.bills() });
  const closeMutation = useMutation({
    mutationFn: (bill: Bill) => api.closeBill(bill.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
    },
  });
  const bills = query.data ?? [];
  return <div className="waiter-page"><p className="eyebrow">TABLE BILLS</p><h1>Bills</h1><p className="muted">Close a bill when a customer leaves. The next order at that table starts a new bill.</p>{query.error && <p className="error" role="alert">Unable to load bills.</p>}{closeMutation.error && <p className="error" role="alert">{closeMutation.error instanceof Error ? closeMutation.error.message : "Unable to close bill."}</p>}<div className="waiter-bill-list">{bills.map((bill) => <article className="card waiter-bill-card" key={bill.id}>
    {bill.status === "CLOSED" && <span aria-label="Bill closed" className="bill-printed-check waiter-closed-check" title="Bill closed"><CheckCircle2 aria-hidden="true" size={22} /></span>}
    <Link className="waiter-bill-main" href={`/waiter/bills/${encodeURIComponent(bill.id)}`}><div><span className="eyebrow">#{bill.billNumber}</span><h2>{bill.table?.tableNumber ?? "Takeaway"}</h2></div><span>{bill.items.length} item line{bill.items.length === 1 ? "" : "s"} · {bill.status === "OPEN" ? "Open" : "Closed"}</span><strong>Rs {Number(bill.totalAmount).toLocaleString()}</strong><span className="waiter-view-bill">View and print bill →</span></Link>
    {bill.status === "OPEN" && <button className="btn secondary waiter-close-bill" disabled={closeMutation.isPending} onClick={() => closeMutation.mutate(bill)} type="button">{closeMutation.isPending && closeMutation.variables?.id === bill.id ? "Closing…" : "Close bill"}</button>}
  </article>)}{!bills.length && <div className="card empty">Bills will appear here when orders are created.</div>}</div></div>;
}
