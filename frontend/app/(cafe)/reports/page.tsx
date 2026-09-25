"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

type Period = "week" | "month";
type DayBucket = { date: Date; label: string; sales: number; quantity: number };
function startOfPeriod(period: Period, today: Date) { const start = new Date(today); start.setHours(0, 0, 0, 0); if (period === "month") start.setDate(1); else start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); return start; }
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }

export default function ReportsPage() {
  const [period, setPeriod] = useState<Period>("week");
  const ordersQuery = useQuery({ queryKey: ["orders"], queryFn: () => api.orders() });
  const today = new Date();
  const report = useMemo(() => {
    const start = startOfPeriod(period, today);
    const orders = (ordersQuery.data ?? []).filter((order) => order.status !== "CANCELLED" && new Date(order.createdAt ?? 0) >= start && new Date(order.createdAt ?? 0) <= today);
    const items = new Map<string, { name: string; quantity: number; sales: number }>();
    for (const order of orders) for (const line of order.items) {
      const key = line.itemName.trim().toLocaleLowerCase();
      const item = items.get(key) ?? { name: line.itemName, quantity: 0, sales: 0 };
      item.quantity += Number(line.quantity);
      item.sales += Number(line.unitPrice) * Number(line.quantity);
      items.set(key, item);
    }
    const buckets: DayBucket[] = [];
    for (const date = new Date(start); date <= today; date.setDate(date.getDate() + 1)) {
      const key = localDateKey(date);
      const dayOrders = orders.filter((order) => localDateKey(new Date(order.createdAt ?? 0)) === key);
      buckets.push({ date: new Date(date), label: period === "week" ? date.toLocaleDateString(undefined, { weekday: "short" }) : String(date.getDate()), sales: dayOrders.reduce((total, order) => total + Number(order.totalAmount), 0), quantity: dayOrders.reduce((total, order) => total + order.items.reduce((count, line) => count + Number(line.quantity), 0), 0) });
    }
    return { start, orders, items: [...items.values()].sort((a, b) => b.quantity - a.quantity || b.sales - a.sales), buckets, sales: orders.reduce((total, order) => total + Number(order.totalAmount), 0), quantity: [...items.values()].reduce((total, item) => total + item.quantity, 0) };
  }, [ordersQuery.data, period, today]);
  const maxSales = Math.max(1, ...report.buckets.map((day) => day.sales));
  const dateRange = `${report.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${today.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`;
  return (
    <section className="sales-report-page">
      <header className="sales-report-heading"><div><p className="eyebrow">SALES OVERVIEW</p><h1>Reports</h1><p>See what is selling and how sales change over time.</p></div><div className="sales-report-period" aria-label="Report period"><button aria-pressed={period === "week"} className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")} type="button">This week</button><button aria-pressed={period === "month"} className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")} type="button">This month</button></div></header>
      <p className="sales-report-dates">{dateRange}</p>
      {ordersQuery.error && <p className="error" role="alert">Unable to load tenant sales data.</p>}
      <div className="sales-report-summary"><article className="card"><span>Sales</span><strong>NPR {report.sales.toLocaleString()}</strong></article><article className="card"><span>Bills</span><strong>{report.orders.length}</strong></article><article className="card"><span>Items sold</span><strong>{report.quantity.toLocaleString()}</strong></article></div>
      <section className="card sales-report-chart-card"><div className="sales-report-section-heading"><div><h2>Sales by day</h2><p>Daily checkout totals · NPR</p></div><span>{period === "week" ? "This week" : "This month"}</span></div><div className="sales-report-chart-scroll"><div className="sales-report-chart" role="img" aria-label={`Daily sales chart for ${period}, total NPR ${report.sales.toLocaleString()}`}>{report.buckets.map((day) => <div className="sales-report-chart-day" key={localDateKey(day.date)} title={`${day.date.toLocaleDateString()}: NPR ${day.sales.toLocaleString()}, ${day.quantity} items`}><strong>{day.sales ? day.sales.toLocaleString() : ""}</strong><div className="sales-report-bar-track"><div className="sales-report-bar" style={{ height: `${day.sales ? Math.max((day.sales / maxSales) * 100, 4) : 0}%` }} /></div><span>{day.label}</span></div>)}</div></div></section>
      <section className="card sales-report-items-card"><div className="sales-report-section-heading"><div><h2>Items sold</h2><p>Sorted from most sold to least sold · tenant orders</p></div></div>{report.items.length ? <div className="sales-report-table-wrap"><table className="sales-report-table"><thead><tr><th>Rank</th><th>Item</th><th>Quantity sold</th><th>Item sales</th><th>Popularity</th></tr></thead><tbody>{report.items.map((item, index) => <tr key={item.name}><td>#{index + 1}</td><td><strong>{item.name}</strong>{index === 0 && <span className="sales-report-badge">Most sold</span>}{index === report.items.length - 1 && <span className="sales-report-badge least">Least sold</span>}</td><td>{item.quantity.toLocaleString()}</td><td>NPR {item.sales.toLocaleString()}</td><td><div className="sales-report-popularity"><span style={{ width: `${Math.max(8, (item.quantity / report.items[0].quantity) * 100)}%` }} /></div></td></tr>)}</tbody></table></div> : <p className="sales-report-empty">No items were sold during this period yet.</p>}</section>
      <p className="sales-report-note">Reports use tenant-scoped orders from the backend.</p>
    </section>
  );
}
