"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function BillsArchive() {
  const pathname = usePathname();
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const query = useQuery({ queryKey: ["bills"], queryFn: () => api.bills(), refetchInterval: 15000, refetchOnWindowFocus: true });
  const bills = (query.data ?? []).filter((bill) => {
    const text = `${bill.billNumber} ${bill.table?.tableNumber ?? ""} ${bill.customer?.name ?? ""}`.toLowerCase();
    const date = bill.createdAt.slice(0, 10);
    return (!search.trim() || text.includes(search.trim().toLowerCase()))
      && (paymentFilter === "ALL" || (paymentFilter === "PAID" ? bill.paymentStatus === "PAID" : bill.paymentStatus !== "PAID"))
      && (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  });

  return <section className="bills-archive">
    <header className="bills-archive-heading"><div><p className="eyebrow">SALES RECORDS</p><h1>Bills</h1><p>Table orders remain together until their bill is settled.</p></div><strong>{bills.length} bill{bills.length === 1 ? "" : "s"}</strong></header>
    <div className="bills-archive-filters" role="search" aria-label="Filter bills">
      <label>Search<input onChange={(event) => setSearch(event.target.value)} placeholder="Bill, table, or customer" value={search} /></label>
      <label>Payment status<select onChange={(event) => setPaymentFilter(event.target.value)} value={paymentFilter}><option value="ALL">All bills</option><option value="PAID">Paid</option><option value="DUE">Balance due</option></select></label>
      <label>From<input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
      <label>To<input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
    </div>
    {query.error && <p className="error" role="alert">Unable to load tenant bills.</p>}
    {bills.length ? <div className="bills-archive-table-wrap"><table className="bills-archive-table"><caption className="sr-only">Sales bills</caption><thead><tr><th scope="col">Bill</th><th scope="col">Date</th><th scope="col">Table</th><th scope="col">Orders</th><th scope="col">Total</th><th scope="col">Paid</th><th scope="col">Balance</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>
      {bills.map((bill) => {
        const total = Number(bill.totalAmount);
        const paid = (bill.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
        const due = Math.max(total - paid, 0);
        const receiptPath = pathname.startsWith("/waiter") ? `/waiter/bills/${encodeURIComponent(bill.id)}` : `/receipt/${encodeURIComponent(bill.id)}`;
        return <tr key={bill.id}><td><strong className="bill-number">{bill.billNumber}</strong></td><td><time dateTime={bill.createdAt}><span className="bill-date">{new Date(bill.createdAt).toLocaleDateString()}</span><span className="bill-time">{new Date(bill.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></time></td><td>{bill.table?.tableNumber ?? "Takeaway"}</td><td>{bill.orderCount}</td><td className="bill-money">NPR {total.toLocaleString()}</td><td className="bill-money">NPR {paid.toLocaleString()}</td><td><span className={due > 0 ? "bill-balance due" : "bill-balance paid"}>{due > 0 ? `NPR ${due.toLocaleString()} due` : "Paid"}</span></td><td><span className={`bill-status ${bill.status.toLowerCase()}`}>{bill.status}</span></td><td>{pathname.startsWith("/cashier") ? bill.status === "OPEN" ? <Link className="bill-view-link" href={`/cashier/pos?billId=${encodeURIComponent(bill.id)}`}>Open in POS</Link> : <span className="muted">History</span> : <Link className="bill-view-link" href={receiptPath}>{pathname.startsWith("/waiter") ? "View bill" : "View / print"}</Link>}</td></tr>;
      })}
    </tbody></table></div> : <div className="card bills-archive-empty"><h2>No matching bills</h2><p>Table bills will appear here when orders are created.</p></div>}
  </section>;
}
