"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";
import { balanceDue, roundMoney } from "@/lib/money";

export function DuePayments() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["orders"], queryFn: () => api.orders(), refetchInterval: 15000, refetchOnWindowFocus: true });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.createPayment(id, { method: "CASH", amount }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      setActiveId(null);
      setAmount("");
      setFormError(null);
    },
  });

  const dues = (query.data ?? [])
    .map((order) => {
      const total = Number(order.totalAmount);
      const paid = (order.payments ?? [])
        .filter((payment) => !payment.status || payment.status === "COMPLETED")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      return { order, total, paid, due: balanceDue(total, paid) };
    })
    .filter(({ order, total, due }) => order.status !== "CANCELLED" && due > 0 && `${order.orderNumber} ${order.table?.tableNumber ?? ""} ${order.customer?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalDue = roundMoney(dues.reduce((sum, entry) => sum + entry.due, 0));

  const settle = (orderId: string, maxDue: number) => {
    const value = roundMoney(Number(amount));
    if (!Number.isFinite(value) || value <= 0) {
      setFormError("Enter a settlement amount greater than zero.");
      return;
    }
    if (value > maxDue) {
      setFormError(`Amount cannot exceed the outstanding NPR ${maxDue.toLocaleString()}.`);
      return;
    }
    setFormError(null);
    mutation.mutate({ id: orderId, amount: value });
  };

  return (
    <section className="due-payments-page">
      <header>
        <h1 className="page-title">Due Payments</h1>
        <p className="muted">Review tenant balances and record settlements.</p>
      </header>

      <div className="card due-summary"><span>Total outstanding</span><strong>NPR {totalDue.toLocaleString()}</strong></div>

      <div className="due-list-filters" role="search">
        <label>Search<input onChange={(event) => setSearch(event.target.value)} placeholder="Bill, customer, or table" value={search} /></label>
      </div>

      {query.error && <p className="error" role="alert">Unable to load tenant balances.</p>}
      {(formError || mutation.error) && <p className="error" role="alert">{formError ?? (mutation.error instanceof Error ? mutation.error.message : "Unable to record payment.")}</p>}

      <div className="card due-list">
        {dues.length ? (
          <div className="menu-manager-table-wrap">
            <table className="table">
              <thead><tr><th>Bill</th><th>Customer</th><th>Table</th><th>Total</th><th>Paid</th><th>Due</th><th>Action</th></tr></thead>
              <tbody>
                {dues.map(({ order, total, paid, due }) => {
                  const billHref = pathname.startsWith("/cashier") ? `/cashier/pos?billId=${encodeURIComponent(order.billId ?? order.id)}` : `/receipt/${encodeURIComponent(order.id)}`;
                  const isActive = activeId === order.id;
                  return (
                    <tr key={order.id}>
                      <td><Link href={billHref}>#{order.orderNumber}</Link></td>
                      <td>{order.customer?.name ?? "Walk-in customer"}</td>
                      <td>{order.table?.tableNumber ?? "—"}</td>
                      <td>NPR {total.toLocaleString()}</td>
                      <td>NPR {paid.toLocaleString()}</td>
                      <td><strong>NPR {due.toLocaleString()}</strong></td>
                      <td>
                        {isActive ? (
                          <form onSubmit={(event) => { event.preventDefault(); settle(order.id, due); }}>
                            <input
                              aria-label="Settlement amount"
                              max={due}
                              min="0.01"
                              onChange={(event) => { setAmount(event.target.value); setFormError(null); }}
                              required
                              step="0.01"
                              type="number"
                              value={amount}
                            />
                            <button className="btn" disabled={mutation.isPending} type="submit">{mutation.isPending ? "Paying…" : "Pay"}</button>
                            <button className="btn secondary" onClick={() => { setActiveId(null); setAmount(""); setFormError(null); }} type="button">Cancel</button>
                          </form>
                        ) : (
                          <button className="btn secondary" onClick={() => { setActiveId(order.id); setAmount(String(due)); setFormError(null); mutation.reset(); }} type="button">Settle</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">No outstanding balances. Part payments taken at the POS show up here until they are settled.</p>
        )}
      </div>
    </section>
  );
}
