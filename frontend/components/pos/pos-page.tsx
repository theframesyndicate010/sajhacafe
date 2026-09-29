"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { CurrentOrder } from "@/components/pos/current-order";
import { MenuSelection } from "@/components/pos/menu-selection";
import { api, type MenuItem, type PaymentMethod } from "@/lib/api/client";
import { balanceDue, roundMoney, settledTotal } from "@/lib/money";
import { usePosStore, nextCounterLineId } from "@/store/pos-store";

const toPaymentMethod = (method: string): PaymentMethod => ({ Cash: "CASH", Card: "CARD", eSewa: "ESEWA", Khalti: "KHALTI", "Bank Transfer": "BANK_TRANSFER", Other: "OTHER" }[method] as PaymentMethod ?? "OTHER");

type CheckoutSummary = { target: string; paid: number; due: number };

export function PosPage({ cashier = false, waiter = false }: { cashier?: boolean; waiter?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pendingOrderId = searchParams.get("orderId");
  const initialBillId = searchParams.get("billId");
  const [selectedBillId, setSelectedBillId] = useState(initialBillId);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [showAllMenuMobile, setShowAllMenuMobile] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [onlinePaymentMethod, setOnlinePaymentMethod] = useState("eSewa");
  const [onlineAmountReceived, setOnlineAmountReceived] = useState("");
  const [reference, setReference] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [counterError, setCounterError] = useState<string | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<CheckoutSummary | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuCategories, setMenuCategories] = useState<string[]>([]);
  const { items, table, customer, add, changeQuantity, setNote, setTable, setCustomer, clear } = usePosStore();
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
  const selectedBillPaid = settledTotal(selectedBill?.payments);
  const selectedBillDue = selectedBill ? balanceDue(selectedBill.totalAmount, selectedBillPaid) : 0;
  const pendingOrderPaid = settledTotal(pendingOrderQuery.data?.payments);
  const pendingOrderDue = pendingOrderQuery.data ? balanceDue(pendingOrderQuery.data.totalAmount, pendingOrderPaid) : 0;

  useEffect(() => { setSelectedBillId(initialBillId); }, [initialBillId]);

  const loadedBillCustomerId = useRef<string | null>(null);
  useEffect(() => {
    if (!cashier) return;
    if (!selectedBill) {
      loadedBillCustomerId.current = null;
      return;
    }
    if (loadedBillCustomerId.current !== selectedBill.id) {
      loadedBillCustomerId.current = selectedBill.id;
      setCustomer(selectedBill.customer?.name ?? "");
    }
  }, [cashier, selectedBill?.customer?.name, selectedBill?.id, setCustomer]);

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

  // The placeholder that backs goods typed straight onto the bill. It is never
  // shown in the menu grid, so it is filtered out of the browsable list below.
  const externalItem = useMemo(() => menuItems.find((item) => item.isExternal) ?? null, [menuItems]);
  const orderPayloadItems = useCallback(
    () => items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      notes: item.note,
      ...(item.isExternal ? { itemName: item.name, unitPrice: item.price } : {}),
    })),
    [items],
  );

  useEffect(() => {
    if (!tables.includes(table)) setTable(tables[0] || "");
  }, [table, tables, setTable]);

  const loadedPendingOrder = useRef<string | null>(null);
  useEffect(() => {
    const order = pendingOrderQuery.data;
    if (!order || loadedPendingOrder.current === order.id) return;
    // Wait for the menu so counter lines are recognised. Loading them as plain
    // menu items would silently re-price them to the placeholder's NPR 0.
    if (menuQuery.isPending) return;
    loadedPendingOrder.current = order.id;
    clear();
    setOrderId(order.id);
    setTable(order.table?.tableNumber ?? "");
    setCustomer(order.customer?.name ?? "Walk-in Customer");
    for (const item of order.items) {
      const quantity = Number(item.quantity);
      if (quantity <= 0) continue;
      const price = Number(item.unitPrice);
      const isExternal = Boolean(externalItem) && item.menuItemId === externalItem?.id;
      add(
        { id: item.menuItemId, name: item.itemName, category: "", price },
        isExternal ? { lineId: nextCounterLineId(), name: item.itemName, price, quantity, isExternal: true } : { quantity },
      );
    }
  }, [add, clear, externalItem, menuQuery.isPending, pendingOrderQuery.data, setCustomer, setTable]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const tax = Math.round(subtotal * 13 / 113);
  const total = subtotal;
  const sendMutation = useMutation({
    mutationFn: async () => {
      const order = await api.createOrder({ orderType: "DINE_IN", tableId: apiTables.find((entry) => entry.tableNumber === table)?.id, customerName: customer.trim() || undefined, items: orderPayloadItems() });
      await api.sendOrderToKitchen(order.id);
      return order;
    },
    onSuccess: async (result) => {
      if (waiter) {
        clear();
        setOrderId(result.id);
        await queryClient.invalidateQueries({ queryKey: ["orders"] });
        return;
      }
      if (cashier && selectedBill) {
        clear();
        setOrderId(null);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["bills"] }),
          queryClient.invalidateQueries({ queryKey: ["orders"] }),
        ]);
        router.push(`/cashier/pos?billId=${encodeURIComponent(selectedBill.id)}`);
        return;
      }
      setOrderId(result.id);
    },
  });

  const billCustomerMutation = useMutation({
    mutationFn: ({ billId, name }: { billId: string; name: string }) => api.updateBillCustomer(billId, name),
    onSuccess: (bill) => {
      queryClient.setQueryData(["bill", bill.id], bill);
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
    },
  });

  const checkoutMutation = useMutation({
    onMutate: () => setCheckoutSummary(null),
    mutationFn: async (): Promise<CheckoutSummary> => {
      const cashAmount = Number(amountReceived) || 0;
      const onlineAmount = Number(onlineAmountReceived) || 0;
      const enteredPayments = paymentMethod === "Split"
        ? [
            { method: "CASH" as PaymentMethod, amount: roundMoney(cashAmount) },
            { method: toPaymentMethod(onlinePaymentMethod), amount: roundMoney(onlineAmount), referenceNumber: reference },
          ]
        : [{ method: toPaymentMethod(paymentMethod), amount: roundMoney(cashAmount), referenceNumber: paymentMethod === "Cash" ? undefined : reference }];
      const tenderedPayments = enteredPayments.filter((part) => part.amount > 0);
      const tendered = roundMoney(tenderedPayments.reduce((sum, part) => sum + part.amount, 0));
      if (tendered <= 0) throw new Error("Enter the amount the customer is paying now, or send the order to the kitchen first.");

      // Any part of the tender above the balance is overpayment (change); the
      // remainder below the balance is deliberately left as a due.
      if (selectedBill) {
        if (selectedBillDue <= 0) throw new Error("This bill has no outstanding balance.");
        await api.updateBillCustomer(selectedBill.id, customer);
        const applied = roundMoney(Math.min(tendered, selectedBillDue));
        let remainingPayment = applied;
        const tenderParts = tenderedPayments.map((part) => ({ ...part, amount: Math.min(part.amount, applied) }));
        const billOrders = selectedBill.orders ?? await Promise.all((selectedBill.orderIds ?? []).map((id) => api.order(id)));
        if (!billOrders.length) throw new Error("This bill has no payable orders. Refresh the bills list and try again.");
        for (const billOrder of billOrders) {
          let orderDue = balanceDue(billOrder.totalAmount, settledTotal(billOrder.payments));
          if (orderDue <= 0 || remainingPayment <= 0) continue;
          const allocation: typeof tenderParts = [];
          for (const part of tenderParts) {
            const amount = roundMoney(Math.min(part.amount, orderDue, remainingPayment));
            if (amount > 0) allocation.push({ ...part, amount });
            orderDue = roundMoney(orderDue - amount);
            remainingPayment = roundMoney(remainingPayment - amount);
            part.amount = roundMoney(part.amount - amount);
            if (orderDue <= 0 || remainingPayment <= 0) break;
          }
          if (allocation.length === 1) await api.createPayment(billOrder.id, allocation[0]);
          else if (allocation.length > 1) await api.createSplitPayment(billOrder.id, allocation);
        }
        return { target: selectedBill.id, paid: applied, due: roundMoney(selectedBillDue - applied) };
      }
      const order = orderId ? await api.order(orderId) : await api.createOrder({ orderType: "DINE_IN", tableId: apiTables.find((entry) => entry.tableNumber === table)?.id, customerName: customer.trim() || undefined, items: orderPayloadItems() });
      if (orderId && customer.trim()) await api.updateBillCustomer(order.id, customer.trim());
      const balance = balanceDue(order.totalAmount, settledTotal(order.payments));
      if (balance <= 0) throw new Error("This order is already fully paid.");
      const applied = roundMoney(Math.min(tendered, balance));
      let paymentBalance = applied;
      const payments = tenderedPayments.map((part) => {
        const amount = roundMoney(Math.min(part.amount, paymentBalance));
        paymentBalance = roundMoney(paymentBalance - amount);
        return { ...part, amount };
      }).filter((part) => part.amount > 0);
      if (paymentMethod === "Split") await api.createSplitPayment(order.id, payments);
      else await api.createPayment(order.id, payments[0]);
      // The bill branch above already returned, so only a fresh order reaches here.
      return { target: order.id, paid: applied, due: roundMoney(balance - applied) };
    },
    onSuccess: (result) => {
      clear();
      if (selectedBill) setCustomer(customer.trim());
      setOrderId(null);
      setAmountReceived("");
      setOnlineAmountReceived("");
      setReference("");
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
      void queryClient.invalidateQueries({ queryKey: ["tables"] });
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      const billHref = cashier ? `/cashier/bills/${encodeURIComponent(result.target)}` : `/receipt/${result.target}`;
      // A part payment stays on the POS so the cashier can see exactly how much
      // landed in the due ledger before moving on.
      if (result.due > 0) setCheckoutSummary(result);
      else router.push(billHref);
    },
  });

  // The counter placeholder is a plumbing row, not something to tap on the grid.
  const browsableMenu = useMemo(() => menuItems.filter((item) => !item.isExternal), [menuItems]);

  const filteredMenu = browsableMenu.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const matchesSearch = item.name.toLowerCase().includes(search.trim().toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const addManualItem = () => {
    const price = Number(manualPrice);
    if (!manualName.trim() || !Number.isFinite(price) || price <= 0) return;
    if (!externalItem) {
      setCounterError("This cafe is missing its counter item setup. Run the seed script, then reload.");
      return;
    }

    // Every counter line points at the same real menu row, so each one needs its
    // own cart key to stay a separate line instead of merging with the last.
    add(
      { id: externalItem.id, name: externalItem.name, category: externalItem.category, price },
      { lineId: nextCounterLineId(), name: manualName.trim(), price, isExternal: true },
    );
    setManualName("");
    setManualPrice("");
    setCounterError(null);
  };

  const error = sendMutation.error || checkoutMutation.error || billCustomerMutation.error || menuQuery.error || tablesQuery.error || pendingOrderQuery.error;
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
      {checkoutSummary && <div className="checkout-summary-banner" role="status">
        <span>
          <strong>NPR {checkoutSummary.paid.toLocaleString()} received</strong>
          {checkoutSummary.due > 0 ? ` · NPR ${checkoutSummary.due.toLocaleString()} recorded as due` : " · settled in full"}
        </span>
        <span className="checkout-summary-actions">
          {checkoutSummary.due > 0 && <Link className="btn secondary" href={cashier ? "/cashier/due-payments" : "/due-payments"}>Open due payments</Link>}
          <Link className="btn secondary" href={cashier ? `/cashier/bills/${encodeURIComponent(checkoutSummary.target)}` : `/receipt/${checkoutSummary.target}`}>View bill</Link>
          <button className="btn" onClick={() => setCheckoutSummary(null)} type="button">Done</button>
        </span>
      </div>}

      <div className={waiter ? "waiter-page waiter-pos-shell" : undefined}>
      <h1 className="page-title">{waiter ? "Point of sale" : cashier ? "Cashier POS" : "Point of sale"}</h1>
      <p className="muted">{waiter ? "Choose a table, add items, and send the order to the kitchen." : cashier ? "Open waiter bills, add customer requests, and print the updated bill." : "Create an order, send its KOT to the kitchen, or complete checkout without leaving the POS."}</p>
      {waiter && orderId && <div className="waiter-submit-success" role="status"><div><strong>Order sent</strong><span>Order #{orderId} · {table} · SENT TO KITCHEN</span></div><button onClick={() => setOrderId(null)} type="button">Create another order</button></div>}

      {cashier && <section aria-label="Open bills" className="cashier-open-bills">
        <div className="cashier-open-bills-heading"><h2>Open bills</h2><span>{openBills.length} active</span></div>
        {billsQuery.error && <p className="error" role="alert">Unable to load open bills.</p>}
        {billsQuery.isLoading ? <p className="muted">Loading bills…</p> : openBills.length ? <div className="cashier-open-bills-list">
          {openBills.map((bill) => <button aria-pressed={selectedBillId === bill.id} className={`cashier-open-bill ${selectedBillId === bill.id ? "selected" : ""}`} key={bill.id} onClick={() => chooseBill(bill.id)} type="button"><span><strong>Bill #{bill.billNumber}</strong><small>{bill.customer?.name ?? "Walk-in customer"} · {bill.table?.tableNumber ?? "Takeaway"} · {bill.orderCount} order{bill.orderCount === 1 ? "" : "s"}</small></span><strong>NPR {Number(bill.totalAmount).toLocaleString()}</strong></button>)}
        </div> : <p className="muted">No open bills. Waiter orders will appear here when created.</p>}
      </section>}

      <div className="pos" style={{ marginTop: 20 }}>
        <MenuSelection
          categories={["All", ...menuCategories]}
          category={category}
          cashier={cashier}
          items={filteredMenu}
          mobileShowMore
          search={search}
          showAllMobileItems={showAllMenuMobile}
          onAddItem={(item) => { if (waiter) setOrderId(null); add(item); }}
          onCategoryChange={(value) => { setCategory(value); setShowAllMenuMobile(false); }}
          onSearchChange={(value) => { setSearch(value); setShowAllMenuMobile(false); }}
          onToggleMobileItems={() => setShowAllMenuMobile((showAll) => !showAll)}
        />

        <CurrentOrder
          amountReceived={amountReceived}
          customer={customer}
          cashierBill={cashier ? selectedBill : undefined}
          billDue={selectedBill ? selectedBillDue : pendingOrderId ? pendingOrderDue : total}
          errorMessage={errorMessage}
          isCheckingOut={checkoutMutation.isPending}
          isSendingKot={sendMutation.isPending}
          items={items}
          manualName={manualName}
          manualPrice={manualPrice}
          counterError={counterError}
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
          onCustomerBlur={() => {
            if (selectedBill && customer.trim() !== (selectedBill.customer?.name ?? "")) {
              billCustomerMutation.mutate({ billId: selectedBill.id, name: customer });
            }
          }}
          onManualNameChange={setManualName}
          onManualPriceChange={setManualPrice}
          onPaymentMethodChange={setPaymentMethod}
          onOnlineAmountReceivedChange={setOnlineAmountReceived}
          onOnlinePaymentMethodChange={setOnlinePaymentMethod}
          onQuantityChange={changeQuantity}
          onNoteChange={setNote}
          onReferenceChange={setReference}
          onPrintBill={() => selectedBill && router.push(`/cashier/bills/${encodeURIComponent(selectedBill.id)}`)}
          onSendKot={() => sendMutation.mutate()}
          onTableChange={setTable}
          waiterMode={waiter}
        />
      </div>
      </div>
    </>
  );
}
