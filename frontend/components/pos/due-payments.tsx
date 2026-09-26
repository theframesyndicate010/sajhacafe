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
  const query = useQuery({ queryKey: ["bills"], queryFn: () => api.bills(), refetchInterval: 15000, refetchOnWindowFocus: true });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [search, setSearch] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async ({ bill, amount }: { bill: NonNullable<typeof query.data>[number]; amount: number }) => {
      let remaining = amount;
      for (const order of bill.orders ?? []) {
        const paid = (order.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
        const due = balanceDue(order.totalAmount, paid);
        const paymentAmount = roundMoney(Math.min(remaining, due));
        if (paymentAmount > 0) {
          await api.createPayment(order.id, { method: "CASH", amount: paymentAmount });
          remaining = roundMoney(remaining - paymentAmount);
        }
        if (remaining <= 0) break;
      }
    },
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
    .map((bill) => {
      const total = Number(bill.totalAmount);
      const paid = (bill.payments ?? [])
        .filter((payment) => !payment.status || payment.status === "COMPLETED")
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      return { bill, total, paid, due: balanceDue(total, paid) };
    })
    .filter(({ bill, due }) => due > 0 && `bill ${bill.billNumber} ${bill.table?.tableNumber ?? ""} ${bill.customer?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalDue = roundMoney(dues.reduce((sum, entry) => sum + entry.due, 0));

  const settle = (bill: NonNullable<typeof query.data>[number], maxDue: number) => {
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
    mutation.mutate({ bill, amount: value });
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
                {dues.map(({ bill, total, paid, due }) => {
                  const billHref = pathname.startsWith("/cashier") ? `/cashier/pos?billId=${encodeURIComponent(bill.id)}` : `/receipt/${encodeURIComponent(bill.id)}`;
                  const isActive = activeId === bill.id;
                  return (
                    <tr key={bill.id}>
                      <td><Link href={billHref}>Bill #{bill.billNumber} · {bill.orderCount} order{bill.orderCount === 1 ? "" : "s"}</Link></td>
                      <td>{bill.customer?.name ?? "Walk-in customer"}</td>
                      <td>{bill.table?.tableNumber ?? "—"}</td>
                      <td>NPR {total.toLocaleString()}</td>
                      <td>NPR {paid.toLocaleString()}</td>
                      <td><strong>NPR {due.toLocaleString()}</strong></td>
                      <td>
                        {pathname.startsWith("/cashier") ? (
                          <Link className="btn secondary" href={billHref}>Settle in POS</Link>
                        ) : isActive ? (
                          <form onSubmit={(event) => { event.preventDefault(); settle(bill, due); }}>
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
                          <button className="btn secondary" onClick={() => { setActiveId(bill.id); setAmount(String(due)); setFormError(null); mutation.reset(); }} type="button">Settle</button>
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
