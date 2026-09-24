"use client";

import { ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export default function PendingPaymentPage() {
  const router = useRouter();
  const query = useQuery({ queryKey: ["orders"], queryFn: () => api.orders() });
  const orders = (query.data ?? []).filter((order) => order.status === "SERVED").map((order) => { const total = Number(order.totalAmount); const paid = (order.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0); return { order, total, paid, due: Math.max(total - paid, 0) }; });
  const pending = orders.filter((entry) => entry.due > 0);
  const paid = orders.filter((entry) => entry.due <= 0);
  return <div className="cashier-pending-page waiter-page"><p className="eyebrow">CASHIER QUEUE</p><h1 className="page-title">Pending Payment</h1><p className="muted">Served tenant orders ready for checkout appear here.</p>{query.error && <p className="error" role="alert">Unable to load pending payments.</p>}<div className="cashier-pending-list">{pending.map(({ order, total, due }) => <article className="card cashier-pending-card" key={order.id}><div className="cashier-pending-heading"><div><p className="eyebrow">#{order.orderNumber}</p><h2>{order.table?.tableNumber ?? "Takeaway"}</h2></div><span className="status-pill"><Clock3 aria-hidden="true" size={14} /> Pending</span></div><div className="cashier-pending-meta"><span>{order.items.length} item lines</span><span>{order.paymentStatus}</span></div><div className="cashier-pending-total">NPR {due.toLocaleString()} due of {total.toLocaleString()}</div><button className="cashier-pending-open" onClick={() => router.push(`/cashier/pos?orderId=${encodeURIComponent(order.id)}`)} type="button">Open in POS for checkout <ArrowUpRight aria-hidden="true" size={17} /></button></article>)}{!pending.length && <div className="card cashier-empty"><CheckCircle2 aria-hidden="true" size={30} /><p>No orders are waiting for payment.</p></div>}</div>{paid.length > 0 && <section className="cashier-completed-section"><h2>Completed payments</h2><div className="cashier-pending-list">{paid.map(({ order, total }) => <article className="card cashier-pending-card cashier-paid-card" key={order.id}><div className="cashier-pending-heading"><div><p className="eyebrow">#{order.orderNumber}</p><h2>{order.table?.tableNumber ?? "Takeaway"}</h2></div><span className="waiter-bill-closed"><CheckCircle2 aria-hidden="true" size={17} /> Paid</span></div><div className="cashier-pending-total">NPR {total.toLocaleString()}</div></article>)}</div></section>}</div>;
}
