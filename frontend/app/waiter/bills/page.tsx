"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export default function WaiterBillsPage() {
  const query = useQuery({ queryKey: ["bills"], queryFn: () => api.bills() });
  const bills = query.data ?? [];
  return <div className="waiter-page"><p className="eyebrow">TABLE BILLS</p><h1>Bills</h1><p className="muted">Open a bill to print it or close its table for the next customer.</p>{query.error && <p className="error" role="alert">Unable to load bills.</p>}<div className="waiter-bill-list">{bills.map((bill) => <article className="card waiter-bill-card" key={bill.id}>
    <Link className="waiter-bill-main" href={`/waiter/bills/${encodeURIComponent(bill.id)}`}><div><span className="eyebrow">#{bill.billNumber}</span><h2>{bill.table?.tableNumber ?? "Takeaway"}</h2></div><span>{bill.items.length} item line{bill.items.length === 1 ? "" : "s"} · {bill.status === "OPEN" ? "Open" : "Closed"}</span><strong>Rs {Number(bill.totalAmount).toLocaleString()}</strong><span className="waiter-view-bill">View bill →</span></Link>
  </article>)}{!bills.length && <div className="card empty">Bills will appear here when orders are created.</div>}</div></div>;
}
