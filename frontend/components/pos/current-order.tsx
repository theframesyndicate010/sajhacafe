import type { CartLine } from "@/store/pos-store";

const paymentMethods = ["Cash", "Card", "eSewa", "Khalti", "Bank Transfer", "Other", "Split"];
const onlinePaymentMethods = ["eSewa", "Khalti", "Card", "Bank Transfer", "Other"];

type CurrentOrderProps = {
  amountReceived: string;
  customer: string;
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
  onSendKot: () => void;
  onTableChange: (value: string) => void;
};

export function CurrentOrder({
  amountReceived,
  customer,
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
  onSendKot,
  onTableChange,
}: CurrentOrderProps) {
  const cashPaid = Number(amountReceived) || 0;
  const onlinePaid = Number(onlineAmountReceived) || 0;
  const paid = paymentMethod === "Split" ? cashPaid + onlinePaid : cashPaid;
  const canAddManualItem = manualName.trim() && Number(manualPrice) > 0;
  const hasItems = items.length > 0;

  return (
    <aside className="card order">
      <h2 style={{ marginTop: 0 }}>Current order</h2>

      <div className="order-details">
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
      </div>

      <div className="manual-item">
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
      </div>

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

      <div className="total"><span>Subtotal (before VAT)</span><strong>NPR {subtotal}</strong></div>
      <div className="total"><span>VAT included (13%)</span><span>NPR {total - subtotal}</span></div>
      <div className="total" style={{ fontSize: 18 }}><strong>Total</strong><strong>NPR {total}</strong></div>

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
              placeholder={`Remaining NPR ${Math.max(total - cashPaid, 0)}`}
              type="number"
              value={onlineAmountReceived}
            />
          </label>
          <label className="field">
            Online reference <span className="muted">(optional)</span>
            <input value={reference} onChange={(event) => onReferenceChange(event.target.value)} placeholder="Transaction reference" />
          </label>
          <p className="split-payment-summary">
            Received NPR {paid} · Remaining NPR {Math.max(total - paid, 0)}
            {paid > total && ` · Change NPR ${paid - total}`}
          </p>
        </div>
      ) : (
        <label className="field">
          {paymentMethod === "Cash" ? "Amount received" : "Payment amount"}
          <input
            min="0"
            onChange={(event) => onAmountReceivedChange(event.target.value)}
            placeholder={`NPR ${total}`}
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

      {paymentMethod === "Cash" && <p className="muted" style={{ fontSize: 13 }}>Change: NPR {Math.max(paid - total, 0)}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}
      {orderId && <p className="tag">KOT sent · Order #{orderId}</p>}

      <div className="form-row" style={{ marginTop: 14 }}>
        <button className="btn secondary" disabled={!hasItems || isSendingKot || Boolean(orderId)} onClick={onSendKot} type="button">
          {isSendingKot ? "Sending…" : orderId ? "KOT sent" : "Send to kitchen"}
        </button>
        <button className="btn" disabled={!hasItems || isCheckingOut} onClick={onCheckout} type="button">
          {isCheckingOut ? "Processing…" : `Checkout · NPR ${total}`}
        </button>
      </div>
    </aside>
  );
}
