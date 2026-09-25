"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function InventoryPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["inventory"], queryFn: api.inventory.list });
  const [minimumValues, setMinimumValues] = useState<Record<string, string>>({});
  const [adjustValues, setAdjustValues] = useState<Record<string, string>>({});
  const minimumMutation = useMutation({
    mutationFn: ({ id, minimumQuantity }: { id: string; minimumQuantity: number }) => api.inventory.update(id, { minimumQuantity }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
  const adjustMutation = useMutation({
    mutationFn: ({ id, quantity }: { id: string; quantity: number }) => api.inventory.adjust(id, quantity, "Inventory page adjustment"),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["inventory"] }),
  });
  const items = query.data ?? [];
  return (
    <section className="inventory-page">
      <header className="inventory-page-heading"><div><h1 className="page-title">Inventory</h1><p className="muted">Track current stock and minimum levels for the active cafe.</p></div><Link className="btn" href="/inventory/new">Add new item</Link></header>
      {query.error && <p className="error" role="alert">Unable to load inventory.</p>}
      <div className="card inventory-table-card">
        {items.length ? <div className="menu-manager-table-wrap"><table className="table"><thead><tr><th>Item</th><th>SKU</th><th>Unit</th><th>Current stock</th><th>Minimum level</th><th>Status</th><th>Actions</th></tr></thead><tbody>{items.map((item) => { const current = Number(item.currentQuantity); const minimum = Number(item.minimumQuantity); const low = Number.isFinite(current) && Number.isFinite(minimum) && current <= minimum; const minimumValue = minimumValues[item.id] ?? String(item.minimumQuantity); const adjustValue = adjustValues[item.id] ?? "1"; return <tr key={item.id}><td>{item.name}</td><td>{item.sku ?? "—"}</td><td>{item.unit}</td><td>{Number.isFinite(current) ? current.toLocaleString() : "Invalid stock value"}</td><td><form className="form-row" onSubmit={(event) => { event.preventDefault(); const value = Number(minimumValue); if (Number.isFinite(value) && value >= 0) minimumMutation.mutate({ id: item.id, minimumQuantity: value }); }}><input aria-label={`Minimum stock level for ${item.name}`} min="0" onChange={(event) => setMinimumValues((values) => ({ ...values, [item.id]: event.target.value }))} required step="any" type="number" value={minimumValue} /><button className="btn secondary" disabled={minimumMutation.isPending} type="submit">Save</button></form></td><td><span className={`tag ${low ? "inventory-low-tag" : ""}`}>{!Number.isFinite(current) || !Number.isFinite(minimum) ? "Needs review" : low ? "Low stock" : "In stock"}</span></td><td><form className="form-row" onSubmit={(event) => event.preventDefault()}><input aria-label={`Stock quantity for ${item.name}`} min="0.001" onChange={(event) => setAdjustValues((values) => ({ ...values, [item.id]: event.target.value }))} required step="any" type="number" value={adjustValue} /><button className="btn secondary" disabled={adjustMutation.isPending} onClick={() => { const amount = Number(adjustValue); if (Number.isFinite(amount) && amount > 0) adjustMutation.mutate({ id: item.id, quantity: amount }); }} type="button">Add</button><button className="btn secondary" disabled={adjustMutation.isPending} onClick={() => { const amount = Number(adjustValue); if (Number.isFinite(amount) && amount > 0) adjustMutation.mutate({ id: item.id, quantity: -amount }); }} type="button">Remove</button></form></td></tr>; })}</tbody></table></div> : <p className="empty">No inventory items yet. Add your first item to begin tracking stock.</p>}
        {(minimumMutation.error || adjustMutation.error) && <p className="error" role="alert">{minimumMutation.error?.message || adjustMutation.error?.message}</p>}
      </div>
    </section>
  );
}
