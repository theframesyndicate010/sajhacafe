import { useCallback, useEffect, useMemo, useState } from "react";
import { ShoppingCart } from "lucide-react";

import ContentCard from "../components/common/ContentCard.jsx";
import DataTable from "../components/common/DataTable.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import PageHeaderCard from "../components/common/PageHeaderCard.jsx";
import { useBusiness } from "../context/useBusiness.js";
import { apiClient } from "../services/apiClient.js";
import { formatCurrency, formatDateTime } from "../services/formatters.js";

export default function SalesPage() {
  const [salesRows, setSalesRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { activeBusiness, activeBusinessId } = useBusiness();

  const loadSales = useCallback(async () => {
    if (!activeBusinessId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await apiClient.getSales(activeBusinessId);
      setSalesRows(response.data || []);
    } catch (loadError) {
      setError(loadError.message || "Sales load bhayena");
    } finally {
      setLoading(false);
    }
  }, [activeBusinessId]);

  useEffect(() => {
    loadSales();
  }, [loadSales]);

  const summary = useMemo(() => {
    const totalRevenue = salesRows.reduce((sum, row) => sum + Number(row.netAmount || 0), 0);
    const totalOrders = salesRows.length;

    return {
      totalRevenue,
      totalOrders,
      avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
    };
  }, [salesRows]);

  const columns = [
    {
      key: "invoiceNumber",
      label: "Receipt",
      render: (row) => row.invoiceNumber || "Manual Sale",
    },
    {
      key: "itemsCount",
      label: "Dishes",
    },
    {
      key: "paymentMethod",
      label: "Payment Method",
    },
    {
      key: "netAmount",
      label: "Net Amount",
      render: (row) => formatCurrency(row.netAmount, activeBusiness?.currencySymbol),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (row) => formatDateTime(row.createdAt),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeaderCard
        title="Order History"
        subtitle="Completed restaurant orders, payment method, ra revenue ekai thau ma hernus"
        actionLabel="Data refresh"
        actionIcon={<ShoppingCart size={15} />}
        actionDisabled={loading}
        onActionClick={loadSales}
      />

      <div className="payment-grid sales-summary-grid">
        <div className="payment-card">
          <p className="payment-label">Completed Orders</p>
          <h5 className="payment-amount">{summary.totalOrders}</h5>
        </div>
        <div className="payment-card">
          <p className="payment-label">Total Revenue</p>
          <h5 className="payment-amount">{formatCurrency(summary.totalRevenue, activeBusiness?.currencySymbol)}</h5>
        </div>
        <div className="payment-card">
          <p className="payment-label">Avg per Order</p>
          <h5 className="payment-amount">
            {formatCurrency(summary.avgOrderValue, activeBusiness?.currencySymbol)}
          </h5>
        </div>
      </div>

      <ContentCard>
        {loading ? <EmptyState title="Sales load hudai cha" message="Tapai ko latest sales tayar gardai..." /> : null}
        {!loading && error ? <EmptyState title="Sales load bhayena" message={error} tone="error" /> : null}
        {!loading && !error ? (
          <DataTable
            columns={columns}
            rows={salesRows}
            title="Completed Orders"
            searchPlaceholder="Receipt no. ya payment method search garnus"
          />
        ) : null}
      </ContentCard>
    </div>
  );
}
