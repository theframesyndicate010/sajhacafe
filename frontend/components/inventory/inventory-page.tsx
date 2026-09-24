"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function InventoryPage() {
  const query = useQuery({ queryKey: ["inventory"], queryFn: api.inventory.list });
  const items = query.data ?? [];
  return (
    <section className="inventory-page">
      <header className="inventory-page-heading"><div><h1 className="page-title">Inventory</h1><p className="muted">Track current stock and minimum levels for the active cafe.</p></div><Link className="btn" href="/inventory/new">Add new item</Link></header>
      {query.error && <p className="error" role="alert">Unable to load inventory.</p>}
      <div className="card inventory-table-card">
        {items.length ? <div className="menu-manager-table-wrap"><table className="table"><thead><tr><th>Item</th><th>SKU</th><th>Unit</th><th>Current stock</th><th>Minimum level</th><th>Status</th></tr></thead><tbody>{items.map((item) => { const low = Number(item.currentQuantity) <= Number(item.minimumQuantity); return <tr key={item.id}><td>{item.name}</td><td>{item.sku ?? "—"}</td><td>{item.unit}</td><td>{Number(item.currentQuantity)}</td><td>{Number(item.minimumQuantity)}</td><td><span className={`tag ${low ? "inventory-low-tag" : ""}`}>{low ? "Low stock" : "In stock"}</span></td></tr>; })}</tbody></table></div> : <p className="empty">No inventory items yet. Add your first item to begin tracking stock.</p>}
      </div>
    </section>
  );
}
