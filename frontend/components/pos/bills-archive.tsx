"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function BillsArchive() {
  const pathname = usePathname();
  const cashierView = pathname.startsWith("/cashier");
  const queryClient = useQueryClient();
  const canManageBills = pathname === "/bills";
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const query = useQuery({ queryKey: ["bills"], queryFn: () => api.bills(), refetchInterval: 15000, refetchOnWindowFocus: true });
  const editMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => api.updateBillCustomer(id, name),
    onSuccess: async () => {
      setEditingId(null);
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteBill(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });
  const bills = (query.data ?? []).filter((bill) => {
    const text = `${bill.billNumber} ${bill.table?.tableNumber ?? ""} ${bill.customer?.name ?? ""}`.toLowerCase();
    const date = bill.createdAt.slice(0, 10);
    return (!search.trim() || text.includes(search.trim().toLowerCase()))
      && (cashierView ? bill.paymentStatus === "PAID" : paymentFilter === "ALL" || (paymentFilter === "PAID" ? bill.paymentStatus === "PAID" : bill.paymentStatus !== "PAID"))
      && (!dateFrom || date >= dateFrom) && (!dateTo || date <= dateTo);
  });
  const actionError = editMutation.error ?? deleteMutation.error;

  return <section className="bills-archive">
    <header className="bills-archive-heading"><div><p className="eyebrow">SALES RECORDS</p><h1>Bills</h1><p>{cashierView ? "Settled bill history. Outstanding balances are listed under Due Payments." : "Table orders remain together until their bill is settled."}</p></div><strong>{bills.length} bill{bills.length === 1 ? "" : "s"}</strong></header>
    <div className="bills-archive-filters" role="search" aria-label="Filter bills">
      <label>Search<input onChange={(event) => setSearch(event.target.value)} placeholder="Bill, table, or customer" value={search} /></label>
      {!cashierView && <label>Payment status<select onChange={(event) => setPaymentFilter(event.target.value)} value={paymentFilter}><option value="ALL">All bills</option><option value="PAID">Paid</option><option value="DUE">Balance due</option></select></label>}
      <label>From<input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} /></label>
      <label>To<input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} /></label>
    </div>
    {query.error && <p className="error" role="alert">Unable to load tenant bills.</p>}
    {actionError && <p className="error" role="alert">{actionError instanceof Error ? actionError.message : "Unable to update bills."}</p>}
    {bills.length ? <div className="bills-archive-table-wrap"><table className="bills-archive-table"><caption className="sr-only">Sales bills</caption><thead><tr><th scope="col">Bill</th><th scope="col">Date</th><th scope="col">Customer</th><th scope="col">Table</th><th scope="col">Orders</th><th scope="col">Total</th><th scope="col">Paid</th><th scope="col">Balance</th><th scope="col">Status</th><th scope="col">Actions</th></tr></thead><tbody>
      {bills.map((bill) => {
        const total = Number(bill.totalAmount);
        const paid = (bill.payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
        const due = Math.max(total - paid, 0);
        const receiptPath = pathname.startsWith("/waiter") ? `/waiter/bills/${encodeURIComponent(bill.id)}` : `/receipt/${encodeURIComponent(bill.id)}`;
        const canDelete = bill.status === "OPEN" && bill.paymentStatus === "UNPAID" && (bill.orderStatuses ?? []).every((status) => status === "DRAFT");
        const isEditing = editingId === bill.id;
        return <tr key={bill.id}><td><strong className="bill-number">{bill.billNumber}</strong></td><td><time dateTime={bill.createdAt}><span className="bill-date">{new Date(bill.createdAt).toLocaleDateString()}</span><span className="bill-time">{new Date(bill.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></time></td><td>{isEditing ? <form className="bill-customer-edit" onSubmit={(event) => { event.preventDefault(); editMutation.mutate({ id: bill.id, name: editingName }); }}><input aria-label={`Customer name for bill ${bill.billNumber}`} autoFocus maxLength={150} onChange={(event) => setEditingName(event.target.value)} placeholder="Walk-in customer" value={editingName} /><button aria-label="Save customer name" className="bill-action save" disabled={editMutation.isPending} type="submit"><Save aria-hidden="true" size={15} /></button><button aria-label="Cancel editing customer" className="bill-action" onClick={() => setEditingId(null)} type="button"><X aria-hidden="true" size={15} /></button></form> : bill.customer?.name ?? "Walk-in customer"}</td><td>{bill.table?.tableNumber ?? "Takeaway"}</td><td>{bill.orderCount}</td><td className="bill-money">NPR {total.toLocaleString()}</td><td className="bill-money">NPR {paid.toLocaleString()}</td><td><span className={due > 0 ? "bill-balance due" : "bill-balance paid"}>{due > 0 ? `NPR ${due.toLocaleString()} due` : "Paid"}</span></td><td><span className={`bill-status ${bill.status.toLowerCase()}`}>{bill.status}</span></td><td>{canManageBills ? <div className="bill-actions"><Link className="bill-action" href={receiptPath}>View</Link>{!isEditing && <button className="bill-action" disabled={bill.status !== "OPEN"} onClick={() => { setEditingId(bill.id); setEditingName(bill.customer?.name ?? ""); editMutation.reset(); deleteMutation.reset(); }} type="button"><Pencil aria-hidden="true" size={14} /> Edit</button>}<button className="bill-action delete" disabled={!canDelete || deleteMutation.isPending} onClick={() => { if (window.confirm(`Permanently delete Bill #${bill.billNumber} and its unsent draft orders?`)) deleteMutation.mutate(bill.id); }} title={canDelete ? "Delete this unpaid draft bill" : "Only unpaid bills with unsent draft orders can be deleted"} type="button"><Trash2 aria-hidden="true" size={14} /> Delete</button></div> : pathname.startsWith("/cashier") ? bill.status === "OPEN" ? <Link className="bill-view-link" href={`/cashier/pos?billId=${encodeURIComponent(bill.id)}`}>Open in POS</Link> : <span className="muted">History</span> : <Link className="bill-view-link" href={receiptPath}>{pathname.startsWith("/waiter") ? "View bill" : "View / print"}</Link>}</td></tr>;
      })}
    </tbody></table></div> : <div className="card bills-archive-empty"><h2>No matching bills</h2><p>Table bills will appear here when orders are created.</p></div>}
  </section>;
}
