import { useState } from "react";
import { ArrowLeft, PlusCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

import ContentCard from "../components/common/ContentCard.jsx";
import PageHeaderCard from "../components/common/PageHeaderCard.jsx";
import { useBusiness } from "../context/useBusiness.js";
import { apiClient } from "../services/apiClient.js";

export default function AddTransactionPage() {
  const navigate = useNavigate();
  const { activeBusiness, activeBusinessId } = useBusiness();

  const [form, setForm] = useState({
    type: "outgoing",
    itemName: "",
    category: "",
    description: "",
    sku: "",
    quantity: "1",
    addToBilling: true,
    paymentMethod: "Cash",
    amount: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const quantityNumber = Math.max(0, Math.floor(Number(form.quantity || 0)));
  const amountNumber = Math.max(0, Number(form.amount || 0));
  const estimatedTotal = Number((quantityNumber * amountNumber).toFixed(2));

  const updateField = (field) => (event) => {
    const nextValue = field === "addToBilling" ? event.target.checked : event.target.value;

    setForm((previous) => ({
      ...previous,
      [field]: nextValue,
    }));
  };

  const submitForm = async (event) => {
    event.preventDefault();

    if (!activeBusinessId) {
      setError("Paila business select garnus.");
      return;
    }

    const numericAmount = Number(form.amount || 0);
    if (!numericAmount || numericAmount <= 0) {
      setError("Amount 0 bhanda mathi hunuparcha.");
      return;
    }

    const quantityInput = Number(form.quantity || 0);
    const quantity = Math.floor(quantityInput);
    if (!Number.isFinite(quantityInput) || quantity <= 0) {
      setError("Quantity kamtima 1 hunuparcha.");
      return;
    }

    const normalizedCategory = String(form.category || "").trim();
    if (!normalizedCategory) {
      setError("Category compulsory cha.");
      return;
    }

    const normalizedItemName = String(form.itemName || "").trim();
    if (form.addToBilling && !normalizedItemName) {
      setError("Billing ma sync garna item name dinu parcha.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const buyingDescription = form.description || normalizedItemName || "Manual buying entry";
      const transactionAmount = Number((numericAmount * quantity).toFixed(2));

      await apiClient.createTransaction({
        businessId: activeBusinessId,
        type: form.type,
        category: normalizedCategory,
        itemName: normalizedItemName,
        description: `${buyingDescription} (Qty: ${quantity})`,
        paymentMethod: form.paymentMethod,
        amount: transactionAmount,
      });

      if (form.addToBilling) {
        await apiClient.createCatalogItem({
          businessId: activeBusinessId,
          name: normalizedItemName,
          category: normalizedCategory,
          sku: form.sku,
          price: numericAmount,
          quantity,
        });
      }

      navigate("/buying");
    } catch (submitError) {
      setError(submitError.message || "Buying entry create bhayena");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeaderCard
        title="Add Supplier Purchase"
        subtitle="Kitchen ingredient purchase add garnus, ra chahe menu availability ma sync garnus"
        actionLabel="Suppliers ma farkinu"
        actionIcon={<ArrowLeft size={15} />}
        onActionClick={() => navigate("/buying")}
      />

      <ContentCard>
        {error ? <div className="state-card state-error">{error}</div> : null}

        <form className="transaction-form-grid" onSubmit={submitForm}>
          <div className="form-field">
            <label className="form-field-label" htmlFor="buyingItemName">
              Item Name
            </label>
            <input
              id="buyingItemName"
              className="filter-input"
              type="text"
              placeholder="Udaharan: chicken, cooking oil, coffee beans"
              value={form.itemName}
              onChange={updateField("itemName")}
            />
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="txnType">
              Transaction Type
            </label>
            <select
              id="txnType"
              className="filter-select"
              value={form.type}
              onChange={updateField("type")}
            >
              <option value="incoming">Incoming (aune)</option>
              <option value="outgoing">Outgoing (jaane)</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="txnCategory">
              Category
            </label>
            <input
              id="txnCategory"
              className="filter-input"
              type="text"
              placeholder="meat, vegetables, beverages"
              value={form.category}
              onChange={updateField("category")}
            />
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="buyingSku">
              SKU (Optional)
            </label>
            <input
              id="buyingSku"
              className="filter-input"
              type="text"
              placeholder="ING-001"
              value={form.sku}
              onChange={updateField("sku")}
            />
          </div>

          <div className="form-field full-row">
            <label className="form-field-label" htmlFor="txnDescription">
              Description
            </label>
            <textarea
              id="txnDescription"
              className="filter-input transaction-textarea"
              placeholder="Supplier purchase ko short note"
              value={form.description}
              onChange={updateField("description")}
            />
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="txnPayment">
              Payment Method
            </label>
            <select
              id="txnPayment"
              className="filter-select"
              value={form.paymentMethod}
              onChange={updateField("paymentMethod")}
            >
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="E-Payment">E-Payment</option>
              <option value="Credit">Credit</option>
            </select>
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="txnAmount">
              Unit Price
            </label>
            <input
              id="txnAmount"
              className="filter-input"
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={form.amount}
              onChange={updateField("amount")}
            />
          </div>

          <div className="form-field">
            <label className="form-field-label" htmlFor="buyingQuantity">
              Quantity
            </label>
            <input
              id="buyingQuantity"
              className="filter-input"
              type="number"
              min={1}
              step={1}
              placeholder="1"
              value={form.quantity}
              onChange={updateField("quantity")}
            />
            <p className="invoice-meta" style={{ margin: "0" }}>
              Estimated total (andaj): {activeBusiness?.currencySymbol || "Rs"} {estimatedTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="form-field full-row">
            <label className="form-field-label" htmlFor="addToBillingCheckbox">
              Yo ingredient menu availability ma sync garnus
            </label>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#334155" }}>
              <input
                id="addToBillingCheckbox"
                checked={form.addToBilling}
                onChange={updateField("addToBilling")}
                type="checkbox"
              />
              Item name, category, code, price, ra quantity menu availability ma add huncha
            </label>
          </div>

          <div className="transaction-submit-row full-row">
            <button
              className="btn-light"
              onClick={() => navigate("/buying")}
              type="button"
              disabled={submitting}
            >
              Cancel
            </button>
            <button className="page-header-btn" type="submit" disabled={submitting}>
              <PlusCircle size={15} />
              {submitting ? "Saving..." : "Save Supplier Purchase"}
            </button>
          </div>
        </form>
      </ContentCard>
    </div>
  );
}
