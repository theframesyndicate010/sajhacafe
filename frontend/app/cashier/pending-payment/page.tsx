"use client";

import { ArrowUpRight, CheckCircle2, Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export default function PendingPaymentPage() {
  const router = useRouter();
  const query = useQuery({ queryKey: ["bills", "OPEN"], queryFn: () => api.bills("OPEN"), refetchInterval: 5000, refetchOnWindowFocus: true });
  // Bills are the checkout unit: several waiter orders for one occupied table
  // belong to the same open bill and must be presented as one payment.
  const bills = (query.data ?? []).filter((bill) => bill.status === "OPEN").map((bill) => {
    const total = Number(bill.totalAmount);
    const paidAmount = (bill.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const due = Math.max(total - paidAmount, 0);
    return { bill, total, due };
  });
  // Once checkout records any payment, any remaining balance belongs in Due
  // Payments rather than the queue of bills still awaiting checkout.
  const pending = bills.filter(({ bill, due }) => due > 0 && bill.paymentStatus === "UNPAID");
  const paid = bills.filter(({ due }) => due <= 0);
  return <div className="cashier-pending-page waiter-page"><p className="eyebrow">CASHIER QUEUE</p><h1 className="page-title">Pending Payment</h1><p className="muted">Open table bills ready for checkout appear here.</p>{query.error && <p className="error" role="alert">Unable to load pending payments.</p>}<div className="cashier-pending-list">{pending.map(({ bill, total, due }) => <article className="card cashier-pending-card" key={bill.id}><div className="cashier-pending-heading"><div><p className="eyebrow">Bill #{bill.billNumber}</p><h2>{bill.table?.tableNumber ?? "Takeaway"}</h2></div><span className="status-pill"><Clock3 aria-hidden="true" size={14} /> Pending</span></div><div className="cashier-pending-meta"><span>{bill.orderCount} order{bill.orderCount === 1 ? "" : "s"} · {bill.items.length} item lines</span><span>{bill.paymentStatus}</span></div><div className="cashier-pending-total">NPR {due.toLocaleString()} due of {total.toLocaleString()}</div><button className="cashier-pending-open" onClick={() => router.push(`/cashier/pos?billId=${encodeURIComponent(bill.id)}`)} type="button">Open bill in POS for checkout <ArrowUpRight aria-hidden="true" size={17} /></button></article>)}{!pending.length && <div className="card cashier-empty"><CheckCircle2 aria-hidden="true" size={30} /><p>No bills are waiting for payment.</p></div>}</div>{paid.length > 0 && <section className="cashier-completed-section"><h2>Completed payments</h2><div className="cashier-pending-list">{paid.map(({ bill, total }) => <article className="card cashier-pending-card cashier-paid-card" key={bill.id}><div className="cashier-pending-heading"><div><p className="eyebrow">Bill #{bill.billNumber}</p><h2>{bill.table?.tableNumber ?? "Takeaway"}</h2></div><span className="waiter-bill-closed"><CheckCircle2 aria-hidden="true" size={17} /> Paid</span></div><div className="cashier-pending-total">NPR {total.toLocaleString()}</div></article>)}</div></section>}</div>;
}
