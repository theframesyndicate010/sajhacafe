"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function DuePayments() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["orders"], queryFn: () => api.orders() });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [search, setSearch] = useState("");
  const mutation = useMutation({ mutationFn: ({ id, amount }: { id: string; amount: number }) => api.createPayment(id, { method: "CASH", amount }), onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["orders"] }); void queryClient.invalidateQueries({ queryKey: ["bills"] }); void queryClient.invalidateQueries({ queryKey: ["tables"] }); setActiveId(null); setAmount(""); } });
  const dues = (query.data ?? []).map((order) => ({ order, total: Number(order.totalAmount), paid: (order.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0) })).filter(({ order, total, paid }) => order.status !== "CANCELLED" && total > paid && `${order.orderNumber} ${order.table?.tableNumber ?? ""} ${order.customer?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalDue = dues.reduce((sum, due) => sum + due.total - due.paid, 0);
  return <section className="due-payments-page"><header><h1 className="page-title">Due Payments</h1><p className="muted">Review tenant balances and record settlements.</p></header><div className="card due-summary"><span>Total outstanding</span><strong>NPR {totalDue.toLocaleString()}</strong></div><div className="due-list-filters" role="search"><label>Search<input onChange={(event) => setSearch(event.target.value)} placeholder="Bill, customer, or table" value={search} /></label></div>{query.error && <p className="error" role="alert">Unable to load tenant balances.</p>}{mutation.error && <p className="error" role="alert">{mutation.error instanceof Error ? mutation.error.message : "Unable to record payment."}</p>}<div className="card due-list">{dues.length ? <div className="menu-manager-table-wrap"><table className="table"><thead><tr><th>Bill</th><th>Customer</th><th>Table</th><th>Total</th><th>Paid</th><th>Due</th><th>Action</th></tr></thead><tbody>{dues.map(({ order, total, paid }) => { const due = total - paid; const billHref = pathname.startsWith("/cashier") ? `/cashier/pos?billId=${encodeURIComponent(order.billId ?? order.id)}` : `/receipt/${encodeURIComponent(order.id)}`; return <tr key={order.id}><td><Link href={billHref}>#{order.orderNumber}</Link></td><td>{order.customer?.name ?? "Walk-in customer"}</td><td>{order.table?.tableNumber ?? "—"}</td><td>NPR {total.toLocaleString()}</td><td>NPR {paid.toLocaleString()}</td><td><strong>NPR {due.toLocaleString()}</strong></td><td>{activeId === order.id ? <form onSubmit={(event) => { event.preventDefault(); const value = Number(amount); if (value > 0 && value <= due) mutation.mutate({ id: order.id, amount: value }); }}><input aria-label="Settlement amount" max={due} min="0.01" onChange={(event) => setAmount(event.target.value)} required step="0.01" type="number" value={amount} /><button className="btn" disabled={mutation.isPending} type="submit">{mutation.isPending ? "Paying…" : "Pay"}</button></form> : <button className="btn secondary" onClick={() => { setActiveId(order.id); setAmount(String(due)); mutation.reset(); }} type="button">Settle</button>}</td></tr>; })}</tbody></table></div> : <p className="empty">No outstanding balances.</p>}</div></section>;
}
