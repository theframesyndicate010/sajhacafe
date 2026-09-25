"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function BillsArchive() {
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const query = useQuery({ queryKey: ["orders"], queryFn: () => api.orders() });
  const orders = (query.data ?? []).filter((order) => {
    const text = `${order.orderNumber} ${order.table?.tableNumber ?? ""} ${order.customer?.name ?? ""}`.toLowerCase();
    const createdAt: unknown = order.createdAt;
    const parsedDate = typeof createdAt === "string"
      ? new Date(createdAt)
      : createdAt instanceof Date
        ? createdAt
        : null;
    const date = parsedDate && Number.isFinite(parsedDate.getTime())
      ? parsedDate.toISOString().slice(0, 10)
      : "";
    return order.status !== "CANCELLED" && (!search.trim() || text.includes(search.trim().toLowerCase())) && (paymentFilter === "ALL" || (paymentFilter === "PAID" ? order.paymentStatus === "PAID" : order.paymentStatus !== "PAID")) && (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  });
  return <section className="bills-archive"><header className="bills-archive-heading"><div><p className="eyebrow">SALES RECORDS</p><h1>Bills</h1><p>Persisted tenant orders and payments.</p></div><strong>{orders.length} bill{orders.length === 1 ? "" : "s"}</strong></header><div className="bills-archive-filters" role="search" aria-label="Filter bills"><label>Search<input onChange={(event) => setSearch(event.target.value)} placeholder="Bill, table, or customer" value={search} /></label><label>Payment status<select onChange={(event) => setPaymentFilter(event.target.value)} value={paymentFilter}><option value="ALL">All bills</option><option value="PAID">Paid</option><option value="DUE">Balance due</option></select></label><label>From<input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label><label>To<input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label></div>{query.error && <p className="error" role="alert">Unable to load tenant bills.</p>}{orders.length ? <div className="bills-archive-table-wrap"><table className="bills-archive-table"><thead><tr><th>Bill</th><th>Date</th><th>Table</th><th>Customer</th><th>Total</th><th>Paid</th><th>Balance</th><th /></tr></thead><tbody>{orders.map((order) => { const total = Number(order.totalAmount); const paid = (order.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0); const due = Math.max(total - paid, 0); return <tr key={order.id}><td><strong>{order.orderNumber}</strong></td><td>{new Date(order.createdAt ?? Date.now()).toLocaleString()}</td><td>{order.table?.tableNumber ?? "—"}</td><td>{order.customer?.name ?? "Walk-in customer"}</td><td>NPR {total.toLocaleString()}</td><td>NPR {paid.toLocaleString()}</td><td><span className={due > 0 ? "bill-balance due" : "bill-balance paid"}>{due > 0 ? `NPR ${due.toLocaleString()} due` : "Paid"}</span></td><td><Link className="bill-view-link" href={`/receipt/${encodeURIComponent(order.id)}`}>View / print</Link></td></tr>; })}</tbody></table></div> : <div className="card bills-archive-empty"><h2>No matching bills</h2><p>Persisted checkout orders will appear here.</p></div>}</section>;
}
