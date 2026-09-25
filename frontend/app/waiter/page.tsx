"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Minus, Plus, Search, Trash2, Utensils } from "lucide-react";
import { api, type MenuItem, type Order } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

export default function WaiterDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const waiterName = user?.name ?? "Waiter";
  const [table, setTable] = useState("");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [orderItems, setOrderItems] = useState<{ id: string; name: string; quantity: number; price: number; note?: string }[]>([]);
  const [submittedOrder, setSubmittedOrder] = useState<Order | null>(null);
  const [error, setError] = useState("");
  const menuQuery = useQuery({ queryKey: ["menu-items"], queryFn: api.menuItems });
  const tablesQuery = useQuery({ queryKey: ["tables"], queryFn: api.tables });
  const menuItems = menuQuery.data ?? [];
  const tables = tablesQuery.data?.filter((entry) => entry.isActive && entry.status !== "OUT_OF_SERVICE") ?? [];
  const categories = [...new Set(menuItems.map((item) => item.category))];
  const submitMutation = useMutation({
    mutationFn: async () => {
      const selectedTable = tables.find((entry) => entry.tableNumber === table);
      const order = await api.createOrder({ orderType: "DINE_IN", tableId: selectedTable?.id, items: orderItems.map((item) => ({ menuItemId: item.id, quantity: item.quantity, notes: item.note })) });
      await api.sendOrderToKitchen(order.id);
      return order;
    },
    onSuccess: (order) => { setSubmittedOrder(order); setOrderItems([]); setError(""); void queryClient.invalidateQueries({ queryKey: ["orders"] }); },
    onError: (submitError) => setError(submitError instanceof Error ? submitError.message : "Could not submit the order."),
  });

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return menuItems.filter((item) => {
      const matchesCategory = category === "All" || item.category === category;
      const matchesSearch = item.name.toLowerCase().includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [category, menuItems, search]);

  const itemCount = orderItems.reduce((total, item) => total + item.quantity, 0);
  const orderTotal = orderItems.reduce((total, item) => total + item.price * item.quantity, 0);

  function addItem(item: MenuItem) {
    setSubmittedOrder(null);
    setOrderItems((currentItems) => {
      const existingItem = currentItems.find((line) => line.id === item.id);

      if (existingItem) {
        return currentItems.map((line) =>
          line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line,
        );
      }

      return [...currentItems, { id: item.id, name: item.name, quantity: 1, price: item.price, note: "" }];
    });
  }

  function changeQuantity(itemId: string, difference: number) {
    setOrderItems((currentItems) =>
      currentItems.flatMap((item) => {
        if (item.id !== itemId) return [item];
        const quantity = item.quantity + difference;
        return quantity > 0 ? [{ ...item, quantity }] : [];
      }),
    );
  }

  function updateNote(itemId: string, note: string) {
    setOrderItems((currentItems) =>
      currentItems.map((item) => (item.id === itemId ? { ...item, note } : item)),
    );
  }

  function submitOrder() { submitMutation.mutate(); }

  return (
    <div className="waiter-page waiter-pos-page">
      <div className="waiter-title">
        <div>
          <p className="eyebrow">WAITER ORDERING</p>
          <h1>Welcome, {waiterName}</h1>
        </div>
        <label className="waiter-table-select">
          <span className="waiter-table-icon"><Utensils aria-hidden="true" size={20} /></span>
          <select aria-label="Select order table" value={table} onChange={(event) => { setTable(event.target.value); setSubmittedOrder(null); }}>
            <option value="">Select a table</option>
            {tables.map((entry) => <option key={entry.id} value={entry.tableNumber}>{entry.tableNumber}</option>)}
          </select>
          <ChevronDown aria-hidden="true" className="waiter-table-chevron" size={16} />
        </label>
      </div>

      {submittedOrder && (
        <div className="waiter-submit-success" role="status">
          <div><strong>Order sent</strong><span>{submittedOrder.orderNumber} · {submittedOrder.table?.tableNumber ?? table} · SENT TO KITCHEN</span></div>
          <button onClick={() => setSubmittedOrder(null)} type="button">Create another order</button>
        </div>
      )}

      <div className="waiter-pos-layout">
        <section className="waiter-menu-panel">
          <div className="waiter-menu-toolbar">
            <h2>Menu</h2>
            <label className="waiter-search"><Search aria-hidden="true" size={17} /><input aria-label="Search menu" onChange={(event) => setSearch(event.target.value)} placeholder="Search menu" value={search} /></label>
          </div>

          <div aria-label="Menu categories" className="tabs waiter-category-tabs">
            {["All", ...categories].map((itemCategory) => (
              <button className={`tab ${category === itemCategory ? "active" : ""}`} key={itemCategory} onClick={() => setCategory(itemCategory)} type="button">
                {itemCategory}
              </button>
            ))}
          </div>

          <div className="waiter-menu-grid">
            {visibleItems.map((item) => (
              <button className="waiter-menu-item" key={item.id} onClick={() => addItem(item)} type="button">
                <span className="waiter-menu-category">{item.category}</span>
                <strong>{item.name}</strong>
                <span className="muted">NPR {item.price.toLocaleString()}</span>
                <span className="waiter-add-item"><Plus aria-hidden="true" size={16} /> Add item</span>
              </button>
            ))}
            {!visibleItems.length && <p className="muted waiter-no-menu">No menu items found.</p>}
          </div>
        </section>

        <aside className="card waiter-current-order">
          <div className="waiter-order-title">
            <h2>Current order</h2>
            <span className="waiter-order-count">{itemCount} items</span>
          </div>

          {!orderItems.length ? (
            <div className="waiter-empty-order"><Utensils aria-hidden="true" size={26} /><p>Add menu items to start this order.</p></div>
          ) : (
            <div className="waiter-order-lines">
              {orderItems.map((item) => (
                <div className="waiter-order-line" key={item.id}>
                  <div className="waiter-order-line-top">
                    <div><strong>{item.name}</strong><br /><small className="muted">NPR {Number(item.price).toLocaleString()} each · NPR {(Number(item.price) * item.quantity).toLocaleString()}</small></div>
                    <button aria-label={`Remove ${item.name}`} className="waiter-remove-item" onClick={() => changeQuantity(item.id, -item.quantity)} type="button"><Trash2 size={16} /></button>
                  </div>
                  <div className="waiter-order-line-bottom">
                    <label className="waiter-note"><span className="sr-only">Note for {item.name}</span><input onChange={(event) => updateNote(item.id, event.target.value)} placeholder="Add item note" value={item.note || ""} /></label>
                    <div className="waiter-quantity"><button aria-label={`Decrease ${item.name}`} onClick={() => changeQuantity(item.id, -1)} type="button"><Minus size={14} /></button><span>{item.quantity}</span><button aria-label={`Increase ${item.name}`} onClick={() => changeQuantity(item.id, 1)} type="button"><Plus size={14} /></button></div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="total waiter-order-total"><strong>Order total</strong><strong>NPR {orderTotal.toLocaleString()}</strong></div>

          {(error || menuQuery.error || tablesQuery.error) && <p className="error">{error || "Unable to load tenant ordering data."}</p>}
          <button className="btn waiter-submit-order" disabled={!table || !orderItems.length || submitMutation.isPending} onClick={submitOrder} type="button">{submitMutation.isPending ? "Sending…" : "Order"}</button>
        </aside>
      </div>
    </div>
  );
}
