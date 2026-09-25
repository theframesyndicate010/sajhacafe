"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export default function WaiterBillsPage() {
  const query = useQuery({ queryKey: ["bills"], queryFn: () => api.bills() });
  const bills = query.data ?? [];
  return <div className="waiter-page"><p className="eyebrow">TABLE BILLS</p><h1>Bills</h1><p className="muted">Each table has one open bill until its orders are fully settled.</p>{query.error && <p className="error" role="alert">Unable to load bills.</p>}<div className="waiter-bill-list">{bills.map((bill) => <Link className="card waiter-bill-card" href={`/waiter/bills/${encodeURIComponent(bill.id)}`} key={bill.id}>{bill.printedAt && <span aria-label="Bill printed" className="bill-printed-check" title={`Printed ${new Date(bill.printedAt).toLocaleString()}`}>✓</span>}<div><span className="eyebrow">#{bill.billNumber}</span><h2>{bill.table?.tableNumber ?? "Takeaway"}</h2></div><span>{bill.items.length} item line{bill.items.length === 1 ? "" : "s"} · {bill.status === "OPEN" ? "Open" : "Closed"}</span><strong>Rs {Number(bill.totalAmount).toLocaleString()}</strong><span className="waiter-view-bill">View bill →</span></Link>)}{!bills.length && <div className="card empty">Bills will appear here when orders are created.</div>}</div></div>;
}
