"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export default function WaiterBillsPage() {
  const query = useQuery({ queryKey: ["orders"], queryFn: () => api.orders() });
  const orders = (query.data ?? []).filter((order) => order.status === "SERVED");
  return <div className="waiter-page"><p className="eyebrow">SERVED ORDERS</p><h1>Bills</h1><p className="muted">Open a persisted tenant order to review or print its receipt.</p>{query.error && <p className="error" role="alert">Unable to load served orders.</p>}<div className="waiter-bill-list">{orders.map((order) => <Link className="card waiter-bill-card" href={`/waiter/bills/${encodeURIComponent(order.id)}`} key={order.id}><div><span className="eyebrow">#{order.orderNumber}</span><h2>{order.table?.tableNumber ?? "Takeaway"}</h2></div><span>{order.items.length} item line{order.items.length === 1 ? "" : "s"}</span><strong>Rs {Number(order.totalAmount).toLocaleString()}</strong><span className="waiter-view-bill">View and print →</span></Link>)}{!orders.length && <div className="card empty">Served orders will appear here.</div>}</div></div>;
}
