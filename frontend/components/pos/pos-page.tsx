"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { CurrentOrder } from "@/components/pos/current-order";
import { MenuSelection } from "@/components/pos/menu-selection";
import { api, type MenuItem, type PaymentMethod } from "@/lib/api/client";
import { usePosStore } from "@/store/pos-store";

const toPaymentMethod = (method: string): PaymentMethod => ({ Cash: "CASH", Card: "CARD", eSewa: "ESEWA", Khalti: "KHALTI", "Bank Transfer": "BANK_TRANSFER", Other: "OTHER" }[method] as PaymentMethod ?? "OTHER");

export function PosPage({ cashier = false }: { cashier?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pendingOrderId = searchParams.get("orderId");
  const initialBillId = searchParams.get("billId");
  const [selectedBillId, setSelectedBillId] = useState(initialBillId);
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
  const billsQuery = useQuery({ queryKey: ["bills", "OPEN"], queryFn: () => api.bills("OPEN"), enabled: cashier, refetchInterval: 5000, refetchOnWindowFocus: true });
  const pendingOrderQuery = useQuery({ queryKey: ["order", pendingOrderId], queryFn: () => api.order(pendingOrderId!), enabled: Boolean(pendingOrderId) });
  const apiTables = useMemo(
    () => tablesQuery.data?.filter((entry) => entry.isActive && entry.status !== "OUT_OF_SERVICE") ?? [],
    [tablesQuery.data],
  );
  const tables = useMemo(() => apiTables.map((entry) => entry.tableNumber), [apiTables]);
  const openBills = (billsQuery.data ?? []).filter((bill) => bill.status === "OPEN");
  const selectedBill = openBills.find((bill) => bill.id === selectedBillId) ?? null;

  useEffect(() => { setSelectedBillId(initialBillId); }, [initialBillId]);

  useEffect(() => {
    if (!cashier || !selectedBill) return;
    if (table !== (selectedBill.table?.tableNumber ?? "")) setTable(selectedBill.table?.tableNumber ?? "");
    if (orderId) setOrderId(null);
  }, [cashier, orderId, selectedBill, setTable, table]);

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
    onSuccess: (result) => {
      if (cashier && selectedBill) {
        clear();
        setOrderId(null);
        void queryClient.invalidateQueries({ queryKey: ["bills"] });
        void queryClient.invalidateQueries({ queryKey: ["orders"] });
        router.push(`/cashier/bills/${encodeURIComponent(selectedBill.id)}`);
        return;
      }
      setOrderId(result.id);
    },
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
      return selectedBill ? selectedBill.id : order.id;
    },
    onSuccess: (completedOrderId) => {
      clear();
      setOrderId(null);
      setAmountReceived("");
      setOnlineAmountReceived("");
      setReference("");
      router.push(cashier ? `/cashier/bills/${encodeURIComponent(completedOrderId)}` : `/receipt/${completedOrderId}`);
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
  const chooseBill = (id: string) => {
    clear();
    setOrderId(null);
    setSelectedBillId(id);
    const bill = openBills.find((entry) => entry.id === id);
    if (bill?.table) setTable(bill.table.tableNumber);
  };

  return (
    <>
      {pendingOrderId && pendingOrderQuery.data && (
        <div className="cashier-checkout-banner">
          <strong>Waiter bill loaded</strong>
          <span>{pendingOrderQuery.data.orderNumber} · {table} · {items.reduce((count, item) => count + item.quantity, 0)} items</span>
        </div>
      )}
      <h1 className="page-title">{cashier ? "Cashier POS" : "Point of sale"}</h1>
      <p className="muted">{cashier ? "Open waiter bills, add customer requests, and print the updated bill." : "Create an order, send its KOT to the kitchen, or complete checkout without leaving the POS."}</p>

      {cashier && <section aria-label="Open bills" className="cashier-open-bills">
        <div className="cashier-open-bills-heading"><h2>Open bills</h2><span>{openBills.length} active</span></div>
        {billsQuery.error && <p className="error" role="alert">Unable to load open bills.</p>}
        {billsQuery.isLoading ? <p className="muted">Loading bills…</p> : openBills.length ? <div className="cashier-open-bills-list">
          {openBills.map((bill) => <button aria-pressed={selectedBillId === bill.id} className={`cashier-open-bill ${selectedBillId === bill.id ? "selected" : ""}`} key={bill.id} onClick={() => chooseBill(bill.id)} type="button"><span><strong>Bill #{bill.billNumber}</strong><small>{bill.table?.tableNumber ?? "Takeaway"} · {bill.orderCount} order{bill.orderCount === 1 ? "" : "s"}</small></span><strong>NPR {Number(bill.totalAmount).toLocaleString()}</strong></button>)}
        </div> : <p className="muted">No open bills. Waiter orders will appear here when created.</p>}
      </section>}

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
          cashierBill={cashier ? selectedBill : undefined}
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
          onAddToBill={() => sendMutation.mutate()}
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
          onPrintBill={() => selectedBill && router.push(`/cashier/bills/${encodeURIComponent(selectedBill.id)}`)}
          onSendKot={() => sendMutation.mutate()}
          onTableChange={setTable}
        />
      </div>
    </>
  );
}
