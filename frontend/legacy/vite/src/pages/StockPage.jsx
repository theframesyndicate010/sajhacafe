import { useEffect, useMemo, useState } from "react";
import { CreditCard, ReceiptText, ShoppingBasket, TrendingUp } from "lucide-react";

import ContentCard from "../components/common/ContentCard.jsx";
import DataTable from "../components/common/DataTable.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import PageHeaderCard from "../components/common/PageHeaderCard.jsx";
import { useBusiness } from "../context/useBusiness.js";
import { apiClient } from "../services/apiClient.js";
import { formatCurrency } from "../services/formatters.js";

const toUnits = (value) => {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
};

export default function StockPage() {
  const [items, setItems] = useState([]);
  const [category, setCategory] = useState("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { activeBusiness, activeBusinessId } = useBusiness();
  const currencySymbol = activeBusiness?.currencySymbol;

  useEffect(() => {
    if (!activeBusinessId) {
      return;
    }

    const loadCatalog = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await apiClient.getCatalog(activeBusinessId);
        setItems(response.data || []);
      } catch (loadError) {
        setError(loadError.message || "Stock items load bhayena");
      } finally {
        setLoading(false);
      }
    };

    loadCatalog();
  }, [activeBusinessId]);

  const categories = useMemo(() => {
    const unique = new Set(items.map((item) => item.category).filter(Boolean));
    return ["all", ...Array.from(unique)];
  }, [items]);

  const filteredItems = useMemo(() => {
    if (category === "all") {
      return items;
    }

    return items.filter((item) => item.category === category);
  }, [category, items]);

  const stockSummary = useMemo(() => {
    const totalSkus = filteredItems.length;
    const totalUnits = filteredItems.reduce((sum, item) => sum + toUnits(item.quantity), 0);
    const outOfStockCount = filteredItems.filter((item) => toUnits(item.quantity) === 0).length;
    const lowStockCount = filteredItems.filter((item) => {
      const quantity = toUnits(item.quantity);
      return quantity > 0 && quantity <= 5;
    }).length;

    const totalValue = filteredItems.reduce((sum, item) => sum + Number(item.price || 0), 0);
    const averageValue = totalSkus ? totalValue / totalSkus : 0;

    return {
      totalSkus,
      totalUnits,
      lowStockCount,
      outOfStockCount,
      averageValue,
    };
  }, [filteredItems]);

  const columns = [
    {
      key: "name",
      label: "Menu Item",
    },
    {
      key: "sku",
      label: "SKU",
      render: (row) => row.sku || "-",
    },
    {
      key: "category",
      label: "Category",
      render: (row) => row.category || "general",
    },
    {
      key: "price",
      label: "Menu Price",
      render: (row) => formatCurrency(row.price, currencySymbol),
    },
    {
      key: "quantity",
      label: "Available Portions",
      render: (row) => toUnits(row.quantity),
    },
    {
      key: "stockStatus",
      label: "Status",
      searchAccessor: (row) => {
        const quantity = toUnits(row.quantity);
        if (quantity === 0) {
          return "out of stock";
        }

        if (quantity <= 5) {
          return "low stock";
        }

        return "in stock";
      },
      render: (row) => {
        const quantity = toUnits(row.quantity);
        if (quantity === 0) {
          return <span className="badge-inactive">Out of stock</span>;
        }

        if (quantity <= 5) {
          return (
            <span
              className="badge-active"
              style={{ background: "#fef3c7", color: "#92400e" }}
            >
              Low stock
            </span>
          );
        }

        return <span className="badge-active">In stock</span>;
      },
    },
  ];

  return (
    <div className="page-stack">
      <PageHeaderCard
        title="Kitchen Stock"
        subtitle="Menu availability, low-stock alert, ra dish pricing sajilai hernus"
      />

      <ContentCard>
        <div className="filter-toolbar">
          <select className="filter-select" value={category} onChange={(event) => setCategory(event.target.value)}>
            {categories.map((entry) => (
              <option key={entry} value={entry}>
                {entry === "all" ? "All Categories" : entry}
              </option>
            ))}
          </select>

          <span className="invoice-meta">{filteredItems.length} menu items listed</span>
        </div>

        {loading ? <EmptyState title="Kitchen stock load hudai cha" message="Menu availability tayar gardai..." /> : null}
        {!loading && error ? <EmptyState title="Kitchen stock load bhayena" message={error} tone="error" /> : null}

        {!loading && !error ? (
          <>
            <div className="payment-grid reports-summary-grid">
              <div className="payment-card">
                <div className="payment-icon blue">
                  <ShoppingBasket size={18} />
                </div>
                <p className="payment-label">Menu Items</p>
                <h5 className="payment-amount">{stockSummary.totalSkus}</h5>
              </div>

              <div className="payment-card">
                <div className="payment-icon green">
                  <ReceiptText size={18} />
                </div>
                <p className="payment-label">Available Portions</p>
                <h5 className="payment-amount">{stockSummary.totalUnits}</h5>
              </div>

              <div className="payment-card">
                <div className="payment-icon orange">
                  <CreditCard size={18} />
                </div>
                <p className="payment-label">Low Availability</p>
                <h5 className="payment-amount">{stockSummary.lowStockCount}</h5>
              </div>

              <div className="payment-card">
                <div className="payment-icon yellow">
                  <TrendingUp size={18} />
                </div>
                <p className="payment-label">Unavailable Dishes</p>
                <h5 className="payment-amount">{stockSummary.outOfStockCount}</h5>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <DataTable
                columns={columns}
                rows={filteredItems}
                title="Menu Availability"
                searchPlaceholder="Dish, menu code, category, wa status search garnus"
              />
            </div>
          </>
        ) : null}
      </ContentCard>
    </div>
  );
}
