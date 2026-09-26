import type { CartLine } from "@/store/pos-store";
import type { Bill } from "@/lib/api/client";
import { roundMoney } from "@/lib/money";

const paymentMethods = ["Cash", "Card", "eSewa", "Khalti", "Bank Transfer", "Other", "Split"];
const onlinePaymentMethods = ["eSewa", "Khalti", "Card", "Bank Transfer", "Other"];

type CurrentOrderProps = {
  amountReceived: string;
  customer: string;
  cashierBill?: Bill | null;
  billDue?: number;
  errorMessage?: string;
  isCheckingOut: boolean;
  isSendingKot: boolean;
  items: CartLine[];
  manualName: string;
  manualPrice: string;
  orderId: string | null;
  paymentMethod: string;
  onlineAmountReceived: string;
  onlinePaymentMethod: string;
  reference: string;
  subtotal: number;
  tables: string[];
  table: string;
  total: number;
  onAddManualItem: () => void;
  onAddToBill?: () => void;
  onAmountReceivedChange: (value: string) => void;
  onCheckout: () => void;
  onCustomerChange: (value: string) => void;
  onManualNameChange: (value: string) => void;
  onManualPriceChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onOnlineAmountReceivedChange: (value: string) => void;
  onOnlinePaymentMethodChange: (value: string) => void;
  onQuantityChange: (id: string, delta: number) => void;
  onReferenceChange: (value: string) => void;
  onPrintBill?: () => void;
  onSendKot: () => void;
  onTableChange: (value: string) => void;
};

export function CurrentOrder({
  amountReceived,
  customer,
  cashierBill,
  billDue = 0,
  errorMessage,
  isCheckingOut,
  isSendingKot,
  items,
  manualName,
  manualPrice,
  orderId,
  paymentMethod,
  onlineAmountReceived,
  onlinePaymentMethod,
  reference,
  subtotal,
  tables,
  table,
  total,
  onAddManualItem,
  onAddToBill,
  onAmountReceivedChange,
  onCheckout,
  onCustomerChange,
  onManualNameChange,
  onManualPriceChange,
  onPaymentMethodChange,
  onOnlineAmountReceivedChange,
  onOnlinePaymentMethodChange,
  onQuantityChange,
  onReferenceChange,
  onPrintBill,
  onSendKot,
  onTableChange,
}: CurrentOrderProps) {
  const cashPaid = Number(amountReceived) || 0;
  const onlinePaid = Number(onlineAmountReceived) || 0;
  const paid = roundMoney(paymentMethod === "Split" ? cashPaid + onlinePaid : cashPaid);
  const checkoutTotal = roundMoney(billDue);
  const appliedTender = roundMoney(Math.min(paid, checkoutTotal));
  const dueAfterTender = roundMoney(Math.max(checkoutTotal - paid, 0));
  const changeAfterTender = roundMoney(Math.max(paid - checkoutTotal, 0));
  const leavesDue = paid > 0 && dueAfterTender > 0;
  const canAddManualItem = manualName.trim() && Number(manualPrice) > 0;
  const hasItems = items.length > 0;
  const checkoutLabel = leavesDue
    ? `Collect NPR ${appliedTender.toLocaleString()} · NPR ${dueAfterTender.toLocaleString()} due`
    : `Checkout · NPR ${checkoutTotal.toLocaleString()}`;

  return (
    <aside className="card order">
      <h2 style={{ marginTop: 0 }}>{cashierBill ? `Bill #${cashierBill.billNumber}` : "Current order"}</h2>

      {cashierBill && <div className="cashier-selected-bill"><span>{cashierBill.table?.tableNumber ?? "Takeaway"} · {cashierBill.orderCount} order{cashierBill.orderCount === 1 ? "" : "s"}</span><strong>Current total · NPR {Number(cashierBill.totalAmount).toLocaleString()}</strong><strong>Balance due · NPR {billDue.toLocaleString()}</strong></div>}

      {!cashierBill && <div className="order-details">
        <label className="field">
          Table
          <select value={table} onChange={(event) => onTableChange(event.target.value)}>
            {tables.map((tableName) => <option key={tableName} value={tableName}>{tableName}</option>)}
          </select>
        </label>

        <label className="field">
          Customer
          <input
            value={customer}
            onChange={(event) => onCustomerChange(event.target.value)}
            placeholder="Walk-in customer"
          />
        </label>
      </div>}

      {!cashierBill && <div className="manual-item">
        <strong>Manual counter item</strong>
        <div className="form-row">
          <label className="field">
            Item name
            <input
              value={manualName}
              onChange={(event) => onManualNameChange(event.target.value)}
              placeholder="e.g. Extra sauce"
            />
          </label>

          <label className="field">
            Price
            <input
              min="0"
              onChange={(event) => onManualPriceChange(event.target.value)}
              placeholder="NPR"
              type="number"
              value={manualPrice}
            />
          </label>

          <button className="btn secondary" disabled={!canAddManualItem} onClick={onAddManualItem} type="button">
            Add item
          </button>
        </div>
      </div>}

      {cashierBill && cashierBill.items.length > 0 && <div className="cashier-existing-items"><strong>Already on bill</strong>{cashierBill.items.map((item) => <div className="order-row" key={item.id}><span>{item.itemName} × {item.quantity}</span><strong>NPR {Number(item.totalAmount).toLocaleString()}</strong></div>)}</div>}

      {cashierBill && hasItems && <strong className="cashier-additions-heading">New items</strong>}
      {items.map((item) => (
        <div className="order-row" key={item.id}>
          <div>
            <strong>{item.name}</strong>
            <br />
            <small className="muted">NPR {item.price} each</small>
          </div>
          <div className="qty">
            <button onClick={() => onQuantityChange(item.id, -1)} type="button">−</button>
            <span>{item.quantity}</span>
            <button onClick={() => onQuantityChange(item.id, 1)} type="button">+</button>
          </div>
        </div>
      ))}

      {cashierBill && hasItems && <div className="total"><span>Additions</span><strong>NPR {total.toLocaleString()}</strong></div>}
      {!cashierBill && <><div className="total"><span>Subtotal (before VAT)</span><strong>NPR {subtotal}</strong></div><div className="total"><span>VAT included (13%)</span><span>NPR {total - subtotal}</span></div><div className="total" style={{ fontSize: 18 }}><strong>Total</strong><strong>NPR {total}</strong></div></>}

      {(!cashierBill || !hasItems) && <>
      <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "18px 0 12px" }} />
      <strong>Checkout</strong>

      <div className="tabs">
        {paymentMethods.map((method) => (
          <button
            className={`tab ${paymentMethod === method ? "active" : ""}`}
            key={method}
            onClick={() => onPaymentMethodChange(method)}
            type="button"
          >
            {method}
          </button>
        ))}
      </div>

      {paymentMethod === "Split" ? (
        <div className="split-payment-fields">
          <label className="field">
            Cash received
            <input
              min="0"
              onChange={(event) => onAmountReceivedChange(event.target.value)}
              placeholder="NPR 0"
              type="number"
              value={amountReceived}
            />
          </label>
          <label className="field">
            Online method
            <select onChange={(event) => onOnlinePaymentMethodChange(event.target.value)} value={onlinePaymentMethod}>
              {onlinePaymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
            </select>
          </label>
          <label className="field">
            Online amount
            <input
              min="0"
              onChange={(event) => onOnlineAmountReceivedChange(event.target.value)}
              placeholder={`Remaining NPR ${roundMoney(Math.max(checkoutTotal - cashPaid, 0))}`}
              type="number"
              value={onlineAmountReceived}
            />
          </label>
          <label className="field">
            Online reference <span className="muted">(optional)</span>
            <input value={reference} onChange={(event) => onReferenceChange(event.target.value)} placeholder="Transaction reference" />
          </label>
        </div>
      ) : (
        <label className="field">
          {paymentMethod === "Cash" ? "Amount received" : "Payment amount"}
          <input
            min="0"
            onChange={(event) => onAmountReceivedChange(event.target.value)}
            placeholder={`NPR ${checkoutTotal}`}
            type="number"
            value={amountReceived}
          />
        </label>
      )}

      {paymentMethod !== "Cash" && paymentMethod !== "Split" && (
        <label className="field">
          Reference number
          <input value={reference} onChange={(event) => onReferenceChange(event.target.value)} placeholder="Transaction reference" />
        </label>
      )}

      {checkoutTotal > 0 && !amountReceived && paymentMethod !== "Split" && (
        <button className="btn secondary pay-full-shortcut" onClick={() => onAmountReceivedChange(String(checkoutTotal))} type="button">
          Pay full amount · NPR {checkoutTotal.toLocaleString()}
        </button>
      )}

      <div className="payment-summary">
        <div><span>Amount due</span><strong>NPR {checkoutTotal.toLocaleString()}</strong></div>
        <div><span>Receiving now</span><strong>NPR {paid.toLocaleString()}</strong></div>
        {leavesDue
          ? <div className="payment-summary-due"><span>Left as due</span><strong>NPR {dueAfterTender.toLocaleString()}</strong></div>
          : changeAfterTender > 0 && <div><span>Change</span><strong>NPR {changeAfterTender.toLocaleString()}</strong></div>}
      </div>

      {leavesDue && <p className="payment-due-note">NPR {dueAfterTender.toLocaleString()} will be saved as a due and can be collected later from the Due Payments page.</p>}
      </>}
      {errorMessage && <p className="error">{errorMessage}</p>}
      {orderId && <p className="tag">KOT sent · Order #{orderId}</p>}

      {cashierBill ? <div className="form-row cashier-bill-actions" style={{ marginTop: 14 }}>
        {hasItems
          ? <button className="btn" disabled={isSendingKot} onClick={onAddToBill} type="button">{isSendingKot ? "Saving and sending…" : "Add items to bill"}</button>
          : <><button className="btn" disabled={checkoutTotal <= 0 || paid <= 0 || isCheckingOut} onClick={onCheckout} type="button">{isCheckingOut ? "Processing…" : checkoutLabel}</button><button className="btn secondary" disabled={isSendingKot} onClick={onPrintBill} type="button">Print bill</button></>}
      </div> : <div className="form-row" style={{ marginTop: 14 }}>
        <button className="btn secondary" disabled={!hasItems || isSendingKot || Boolean(orderId)} onClick={onSendKot} type="button">
          {isSendingKot ? "Sending…" : orderId ? "KOT sent" : "Send to kitchen"}
        </button>
        <button className="btn" disabled={!hasItems || isCheckingOut || checkoutTotal <= 0 || paid <= 0} onClick={onCheckout} type="button">
          {isCheckingOut ? "Processing…" : checkoutLabel}
        </button>
      </div>
      }
    </aside>
  );
}
