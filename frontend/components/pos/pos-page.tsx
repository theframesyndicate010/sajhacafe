"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { CurrentOrder } from "@/components/pos/current-order";
import { MenuSelection } from "@/components/pos/menu-selection";
import { api, type MenuItem, type PaymentMethod } from "@/lib/api/client";
import { usePosStore } from "@/store/pos-store";

const toPaymentMethod = (method: string): PaymentMethod => ({ Cash: "CASH", Card: "CARD", eSewa: "ESEWA", Khalti: "KHALTI", "Bank Transfer": "BANK_TRANSFER", Other: "OTHER" }[method] as PaymentMethod ?? "OTHER");

export function PosPage({ cashier = false }: { cashier?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingOrderId = searchParams.get("orderId");
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [onlinePaymentMethod, setOnlinePaymentMethod] = useState("eSewa");
  const [onlineAmountReceived, setOnlineAmountReceived] = useState("");
  const [reference, setReference] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<string[]>([]);
  const { items, table, customer, add, changeQuantity, setTable, setCustomer, clear } = usePosStore();
  const menuQuery = useQuery({ queryKey: ["menu-items"], queryFn: api.menuItems });
  const tablesQuery = useQuery({ queryKey: ["tables"], queryFn: api.tables });
  const pendingOrderQuery = useQuery({ queryKey: ["order", pendingOrderId], queryFn: () => api.order(pendingOrderId!), enabled: Boolean(pendingOrderId) });
  const apiTables = useMemo(
    () => tablesQuery.data?.filter((entry) => entry.isActive && entry.status !== "OUT_OF_SERVICE") ?? [],
    [tablesQuery.data],
  );
  const tables = useMemo(() => apiTables.map((entry) => entry.tableNumber), [apiTables]);

  useEffect(() => {
    const nextItems = menuQuery.data ?? [];
    setMenuItems(nextItems);
    setMenuCategories([...new Set(nextItems.map((item) => item.category))]);
  }, [menuQuery.data]);

  useEffect(() => {
    if (!tables.includes(table)) setTable(tables[0] || "");
  }, [table, tables, setTable]);

  const loadedPendingOrder = useRef<string | null>(null);
  useEffect(() => {
    const order = pendingOrderQuery.data;
    if (!order || loadedPendingOrder.current === order.id) return;
    loadedPendingOrder.current = order.id;
    clear();
    setOrderId(order.id);
    setTable(order.table?.tableNumber ?? "");
    setCustomer(order.customer?.name ?? "Walk-in Customer");
    for (const item of order.items) for (let quantity = 0; quantity < Number(item.quantity); quantity += 1) add({ id: item.menuItemId, name: item.itemName, category: "", price: Number(item.unitPrice) });
  }, [add, clear, pendingOrderQuery.data, setCustomer, setTable]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const tax = Math.round(subtotal * 13 / 113);
  const total = subtotal;
  const sendMutation = useMutation({
    mutationFn: async () => {
      const order = await api.createOrder({ orderType: "DINE_IN", tableId: apiTables.find((entry) => entry.tableNumber === table)?.id, items: items.map((item) => ({ menuItemId: item.id, quantity: item.quantity, notes: item.note })) });
      await api.sendOrderToKitchen(order.id);
      return order;
    },
    onSuccess: (result) => setOrderId(result.id),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const cashAmount = Number(amountReceived) || 0;
      const onlineAmount = Number(onlineAmountReceived) || 0;
      const payments = paymentMethod === "Split"
        ? [
            { method: "CASH" as PaymentMethod, amount: cashAmount },
            { method: toPaymentMethod(onlinePaymentMethod), amount: onlineAmount, referenceNumber: reference },
          ].filter((part) => part.amount > 0)
        : [{ method: toPaymentMethod(paymentMethod), amount: cashAmount, referenceNumber: paymentMethod === "Cash" ? undefined : reference }];
      const order = orderId ? await api.order(orderId) : await api.createOrder({ orderType: "DINE_IN", tableId: apiTables.find((entry) => entry.tableNumber === table)?.id, items: items.map((item) => ({ menuItemId: item.id, quantity: item.quantity, notes: item.note })) });
      const paid = payments.reduce((sum, part) => sum + part.amount, 0);
      if (paid < Number(order.totalAmount)) throw new Error(`Payment is short by NPR ${Number(order.totalAmount) - paid}`);
      if (paymentMethod === "Split") await api.createSplitPayment(order.id, payments);
      else await api.createPayment(order.id, payments[0]);
      return order.id;
    },
    onSuccess: (completedOrderId) => {
      clear();
      setOrderId(null);
      setAmountReceived("");
      setOnlineAmountReceived("");
      setReference("");
      router.push(cashier ? "/cashier/pending-payment" : `/receipt/${completedOrderId}`);
    },
  });

  const filteredMenu = menuItems.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const matchesSearch = item.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addManualItem = () => {
    const price = Number(manualPrice);
    if (!manualName.trim() || !Number.isFinite(price) || price <= 0) return;

    add({
      id: `manual-${Date.now()}`,
      name: manualName.trim(),
      category: "Manual",
      price,
    });
    setManualName("");
    setManualPrice("");
  };

  const error = sendMutation.error || checkoutMutation.error || menuQuery.error || tablesQuery.error || pendingOrderQuery.error;
  const errorMessage = error instanceof Error ? error.message : undefined;

  return (
    <>
      {pendingOrderId && pendingOrderQuery.data && (
        <div className="cashier-checkout-banner">
          <strong>Waiter bill loaded</strong>
          <span>{pendingOrderQuery.data.orderNumber} · {table} · {items.reduce((count, item) => count + item.quantity, 0)} items</span>
        </div>
      )}
      <h1 className="page-title">Point of sale</h1>
      <p className="muted">Create an order, send its KOT to the kitchen, or complete checkout without leaving the POS.</p>

      <div className="pos" style={{ marginTop: 20 }}>
        <MenuSelection
          categories={["All", ...menuCategories]}
          category={category}
          items={filteredMenu}
          search={search}
          onAddItem={add}
          onCategoryChange={setCategory}
          onSearchChange={setSearch}
        />

        <CurrentOrder
          amountReceived={amountReceived}
          customer={customer}
          errorMessage={errorMessage}
          isCheckingOut={checkoutMutation.isPending}
          isSendingKot={sendMutation.isPending}
          items={items}
          manualName={manualName}
          manualPrice={manualPrice}
          orderId={orderId}
          paymentMethod={paymentMethod}
          onlineAmountReceived={onlineAmountReceived}
          onlinePaymentMethod={onlinePaymentMethod}
          reference={reference}
          subtotal={subtotal - tax}
          tables={tables}
          table={table}
          total={total}
          onAddManualItem={addManualItem}
          onAmountReceivedChange={setAmountReceived}
          onCheckout={() => checkoutMutation.mutate()}
          onCustomerChange={setCustomer}
          onManualNameChange={setManualName}
          onManualPriceChange={setManualPrice}
          onPaymentMethodChange={setPaymentMethod}
          onOnlineAmountReceivedChange={setOnlineAmountReceived}
          onOnlinePaymentMethodChange={setOnlinePaymentMethod}
          onQuantityChange={changeQuantity}
          onReferenceChange={setReference}
          onSendKot={() => sendMutation.mutate()}
          onTableChange={setTable}
        />
      </div>
    </>
  );
}
