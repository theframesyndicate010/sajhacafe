"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Order } from "@/lib/api/client";

const filters = ["All", "SENT_TO_KITCHEN", "PREPARING", "READY", "SERVED"] as const;
const labels: Record<typeof filters[number], string> = { All: "All", SENT_TO_KITCHEN: "Sent to kitchen", PREPARING: "Cooking", READY: "Ready", SERVED: "Served" };

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const query = useQuery({ queryKey: ["orders"], queryFn: () => api.orders() });
  const mutation = useMutation({ mutationFn: (id: string) => api.serveOrder(id), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["orders"] }); } });
  const orders = (query.data ?? []).filter((order) => order.status !== "CANCELLED" && (filter === "All" || order.status === filter));
  return (
    <div className="waiter-page">
      <p className="eyebrow">SERVICE QUEUE</p><h1>My Orders</h1><p className="muted">Update tenant order progress and open persisted receipts.</p>
      <div className="tabs waiter-filters">{filters.map((value) => <button className={`tab ${filter === value ? "active" : ""}`} key={value} onClick={() => setFilter(value)} type="button">{labels[value]}</button>)}</div>
      {mutation.error && <p className="error" role="alert">{mutation.error.message || "Unable to mark order as served. Please try again."}</p>}
      <div className="waiter-orders">{orders.map((order) => { const canServe = !["SERVED", "COMPLETED", "CANCELLED"].includes(order.status); return <article className="card waiter-order-card" key={order.id}><div className="waiter-order-heading"><div><p className="eyebrow">#{order.orderNumber}</p><h2>{order.table?.tableNumber ?? "Takeaway"}</h2><small>{new Date(order.createdAt ?? Date.now()).toLocaleString()}</small></div><span className={`status-pill ${order.status.toLowerCase()}`}>{labels[order.status as typeof filters[number]] ?? order.status}</span></div><ul>{order.items.map((item) => <li key={item.id}><span>{item.itemName} × {item.quantity} · NPR {Number(item.unitPrice).toLocaleString()} each · NPR {Number(item.totalAmount).toLocaleString()}</span>{item.notes && <small>{item.notes}</small>}</li>)}</ul>{canServe && <div className="waiter-order-actions"><button className="btn" disabled={mutation.isPending} onClick={() => mutation.mutate(order.id)} type="button">Mark served</button></div>}{order.status === "SERVED" && <Link className="waiter-view-bill" href={`/waiter/bills/${encodeURIComponent(order.id)}`}>View and print receipt</Link>}</article>; })}{!orders.length && <div className="card empty">No orders in this section.</div>}</div>
    </div>
  );
}
