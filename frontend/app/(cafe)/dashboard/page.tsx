"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard", "summary"], queryFn: api.dashboard, refetchInterval: 30_000 });
  if (isLoading) return <p className="muted">Loading dashboard…</p>;
  if (error) return <p className="error">{error.message}</p>;
  if (!data) return null;
  return <div className="page-stack cafe-dashboard-page">
    <section className="dash-header-row"><div><h1 className="dash-main-title">Today&apos;s Cafe Snapshot</h1><p className="dash-date">Live data from the backend</p></div></section>
    <section className="cafe-payment-grid">
      {[["Sales", `NPR ${Number(data.sales).toLocaleString()}`], ["Orders", data.orders], ["Pending KOT", data.pendingKot], ["Low stock", data.lowStockItems]].map(([label, value]) => <article className="payment-card" key={String(label)}><h6 className="payment-label">{label}</h6><h5 className="payment-amount">{value}</h5></article>)}
    </section>
    <section className="cafe-main-grid"><article className="dash-card"><h3>Kitchen</h3><p>Pending {data.pendingKot} · Preparing {data.preparingKot} · Ready {data.readyKot}</p></article><article className="dash-card"><h3>Tables</h3><p>Occupied {data.occupiedTables} · Available {data.availableTables}</p></article></section>
  </div>;
}
