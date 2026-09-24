import { useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Legend,
  Tooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  Banknote,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  IndianRupee,
  Smartphone,
  Soup,
  Tags,
  TrendingUp,
  UtensilsCrossed,
  Zap,
  Armchair,
  ShoppingCart,
} from "lucide-react";

import EmptyState from "../components/common/EmptyState.jsx";
import { useBusiness } from "../context/useBusiness.js";
import { apiClient } from "../services/apiClient.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Tooltip);

const paymentCards = [
  { label: "Cash", icon: Banknote, toneClass: "bg-green-icon" },
  { label: "PhonePe", icon: Smartphone, toneClass: "bg-blue-icon" },
  { label: "E-Payment", icon: Zap, toneClass: "bg-orange-icon" },
  { label: "Credit", icon: CreditCard, toneClass: "bg-yellow-icon" },
];

function formatMoney(value, symbol, digits = 2) {
  const numericValue = Number(value || 0);

  return `${symbol} ${numericValue.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { activeBusiness, activeBusinessId } = useBusiness();

  useEffect(() => {
    if (!activeBusinessId) {
      return;
    }

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await apiClient.getDashboard(activeBusinessId);
        setDashboard(response.data);
      } catch (loadError) {
        setError(loadError.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [activeBusinessId]);

  const snapshot = dashboard?.snapshot;
  const currencySymbol = activeBusiness?.currencySymbol || "Rs";

  const paymentBreakdownMap = useMemo(() => {
    const breakdown = snapshot?.paymentBreakdown || [];

    return breakdown.reduce((result, entry) => {
      const method = String(entry?.method || "").toLowerCase();
      result[method] = Number(entry?.amount || 0);
      return result;
    }, {});
  }, [snapshot]);

  const displayDate = useMemo(() => {
    return new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  const totals = useMemo(() => {
    const ready = Number(snapshot?.ordersReady ?? snapshot?.readyOrders ?? 0);
    const processing = Number(snapshot?.ordersProcessing ?? snapshot?.processingOrders ?? 0);
    const cancelled = Number(snapshot?.ordersCancelled ?? snapshot?.cancelledOrders ?? 0);
    const vacantTables = Number(snapshot?.vacantTables ?? 15);
    const reservedTables = Number(snapshot?.reservedTables ?? 1);
    const totalTables = vacantTables + reservedTables || 16;
    const todaySalesAmount = Number(snapshot?.todaySalesAmount ?? 0);
    const todayIncoming = Number(snapshot?.todayIncoming ?? 0);
    const todayOutgoing = Number(snapshot?.todayOutgoing ?? 0);
    const todayNetSell = Number((todayIncoming - todayOutgoing).toFixed(2));
    const todayNetSales = todaySalesAmount > 0 ? todaySalesAmount : todayIncoming;

    return {
      todayNetSales,
      todayNetSell,
      todayPurchase: todayOutgoing,
      totalSalesAmount: todaySalesAmount,
      totalDiscountAmount: Number(snapshot?.todayDiscountAmount ?? 0),
      averageOrderValue: Number(snapshot?.avgInvoiceValue ?? 0),
      ready,
      processing,
      cancelled,
      vacantTables,
      reservedTables,
      totalTables,
      vacantPercent: totalTables > 0 ? (vacantTables / totalTables) * 100 : 0,
    };
  }, [snapshot]);

  const ordersSeries = useMemo(() => dashboard?.ordersSeries || [], [dashboard]);
  const revenueSeries = useMemo(() => dashboard?.revenueSeries || [], [dashboard]);

  const ordersChartData = useMemo(
    () => ({
      labels: ordersSeries.map((entry) => entry.label),
      datasets: [
        {
          label: "Orders",
          data: ordersSeries.map((entry) => Number(entry.count || 0)),
          backgroundColor: "#66bb6a",
          borderRadius: 3,
          barPercentage: 0.6,
          categoryPercentage: 0.8,
        },
      ],
    }),
    [ordersSeries],
  );

  const ordersChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1500, easing: "easeOutQuart" },
      plugins: {
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleFont: { family: "Inter, sans-serif", size: 13 },
          bodyFont: { family: "Inter, sans-serif", size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
        },
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { family: "Inter, sans-serif", size: 11 },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { family: "Inter, sans-serif" } },
          grid: { color: "#f0f0f0" },
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: "Inter, sans-serif", size: 10 } },
        },
      },
    }),
    [],
  );

  const salesChartData = useMemo(
    () => ({
      labels: revenueSeries.map((entry) => entry.label),
      datasets: [
        {
          label: "Sales Revenue",
          data: revenueSeries.map((entry) => Number(entry.revenue || 0)),
          backgroundColor: "#66bb6a",
          borderRadius: 3,
          barPercentage: 0.6,
          categoryPercentage: 0.8,
        },
      ],
    }),
    [revenueSeries],
  );

  const salesChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 1500, easing: "easeOutQuart" },
      indexAxis: "y",
      plugins: {
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.9)",
          titleFont: { family: "Inter, sans-serif", size: 13 },
          bodyFont: { family: "Inter, sans-serif", size: 12 },
          padding: 10,
          cornerRadius: 8,
          displayColors: true,
        },
        legend: {
          position: "top",
          labels: {
            usePointStyle: true,
            boxWidth: 8,
            font: { family: "Inter, sans-serif", size: 11 },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            callback: (value) => {
              if (Number(value) === 0) {
                return `${currencySymbol} 0`;
              }
              return `${currencySymbol} ${value}`;
            },
            font: { family: "Inter, sans-serif", size: 10 },
          },
          grid: { color: "#f0f0f0" },
        },
        y: {
          grid: { display: false },
          ticks: { font: { family: "Inter, sans-serif" } },
        },
      },
    }),
    [currencySymbol],
  );

  if (loading) {
    return (
      <div className="page-stack cafe-dashboard-page">
        <EmptyState message="Loading dashboard metrics..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-stack cafe-dashboard-page">
        <EmptyState message={error} />
      </div>
    );
  }

  if (!snapshot) {
    return (
      <div className="page-stack cafe-dashboard-page">
        <EmptyState message="No dashboard data available for this business." />
      </div>
    );
  }

  return (
    <div className="page-stack cafe-dashboard-page">
      <section className="dash-header-row fade-in-up delay-1">
        <div className="dash-heading-cluster">
          <div className="dash-icon-box bg-success-icon">
            <IndianRupee size={24} />
          </div>
          <div>
            <h4 className="dash-main-title">Today&apos;s Restaurant Snapshot</h4>
            <p className="dash-date">{displayDate}</p>
          </div>
        </div>

        <div className="dash-stat-group">
          <article className="dash-stat-badge bg-navy">
            <div className="dash-stat-copy">
              <span className="dash-stat-label">Today&apos;s Orders</span>
              <span className="dash-stat-value">{formatMoney(totals.todayNetSales, currencySymbol, 0)}</span>
            </div>
            <span className="dash-stat-icon" aria-hidden="true">
              <IndianRupee size={16} />
            </span>
          </article>

          <article className="dash-stat-badge bg-navy">
            <div className="dash-stat-copy">
              <span className="dash-stat-label">Today&apos;s Revenue</span>
              <span className="dash-stat-value">{formatMoney(totals.todayNetSell, currencySymbol, 0)}</span>
            </div>
            <span className="dash-stat-icon" aria-hidden="true">
              <TrendingUp size={16} />
            </span>
          </article>

          <article className="dash-stat-badge bg-navy">
            <div className="dash-stat-copy">
              <span className="dash-stat-label">Kitchen Purchases</span>
              <span className="dash-stat-value">{formatMoney(totals.todayPurchase, currencySymbol, 0)}</span>
            </div>
            <span className="dash-stat-icon" aria-hidden="true">
              <ShoppingCart size={16} />
            </span>
          </article>
        </div>
      </section>

      <section className="cafe-payment-grid fade-in-up delay-1">
        {paymentCards.map((card) => {
          const Icon = card.icon;
          const amount = Number(paymentBreakdownMap[card.label.toLowerCase()] || 0);

          return (
            <article className="payment-card" key={card.label}>
              <div className={`payment-icon ${card.toneClass}`}>
                <Icon size={20} />
              </div>
              <h6 className="payment-label">{card.label}</h6>
              <h5 className="payment-amount">{formatMoney(amount, currencySymbol)}</h5>
            </article>
          );
        })}
      </section>

      <section className="cafe-main-grid fade-in-up delay-2">
        <article className="dash-card quick-stats-card">
          <div className="quick-stat-item">
            <div className="quick-stat-icon tone-success" aria-hidden="true">
              <IndianRupee size={18} />
            </div>
            <div>
              <p className="quick-stat-label">Total Sales Amount</p>
              <h5 className="quick-stat-value">{formatMoney(totals.totalSalesAmount, currencySymbol)}</h5>
            </div>
          </div>

          <div className="quick-stat-item">
            <div className="quick-stat-icon tone-primary" aria-hidden="true">
              <Tags size={18} />
            </div>
            <div>
              <p className="quick-stat-label">Total Discount Amount</p>
              <h5 className="quick-stat-value">{formatMoney(totals.totalDiscountAmount, currencySymbol)}</h5>
            </div>
          </div>

          <div className="quick-stat-item">
            <div className="quick-stat-icon tone-warning" aria-hidden="true">
              <TrendingUp size={18} />
            </div>
            <div>
              <p className="quick-stat-label">Average Order Value</p>
              <h5 className="quick-stat-value">{formatMoney(totals.averageOrderValue, currencySymbol)}</h5>
            </div>
          </div>
        </article>

        <article className="dash-card chart-card">
          <h6 className="chart-title">
            <ClipboardCheck size={16} />
            <span>No. Of Orders</span>
          </h6>
          <div className="chart-container">
            <Bar data={ordersChartData} options={ordersChartOptions} />
          </div>
        </article>

        <article className="dash-card chart-card">
          <h6 className="chart-title">
            <UtensilsCrossed size={16} />
            <span>Kitchen &amp; Bar Sales ({currencySymbol})</span>
          </h6>
          <div className="chart-container">
            <Bar data={salesChartData} options={salesChartOptions} />
          </div>
        </article>
      </section>

      <section className="fade-in-up delay-3">
        <div className="cafe-ops-header">
          <div className="ops-section-icon" aria-hidden="true">
            <CheckCircle2 size={16} />
          </div>
          <h5 className="dash-main-title">Today&apos;s Operations</h5>
        </div>

        <div className="cafe-ops-grid">
          <article className="parchment-wrapper">
            <div className="parchment-card">
              <div className="parchment-header">
                <ClipboardCheck size={14} />
                <span>Orders in Progress</span>
              </div>
              <div className="parchment-body">
                <div className="gauge-list">
                  <div className="gauge-item">
                    <div className="gauge-ring-container gauge-green">
                      <div className="gauge-ring-inner">
                        <span className="gauge-number">{totals.ready}</span>
                      </div>
                    </div>
                    <span className="gauge-label">Ready</span>
                  </div>

                  <div className="gauge-item">
                    <div className="gauge-ring-container gauge-yellow">
                      <div className="gauge-ring-inner">
                        <span className="gauge-number">{totals.processing}</span>
                      </div>
                    </div>
                    <span className="gauge-label">Processing</span>
                  </div>

                  <div className="gauge-item">
                    <div className="gauge-ring-container gauge-red">
                      <div className="gauge-ring-inner">
                        <span className="gauge-number">{totals.cancelled}</span>
                      </div>
                    </div>
                    <span className="gauge-label">Cancelled</span>
                  </div>
                </div>

                <div className="ops-gradient-bar" aria-hidden="true">
                  <span className="gradient-segment seg-green" />
                  <span className="gradient-segment seg-yellow" />
                  <span className="gradient-segment seg-red" />
                </div>

                <div className="ops-label-row">
                  <span className="ops-bar-label">{totals.ready}</span>
                  <span className="ops-bar-label">{totals.processing}</span>
                  <span className="ops-bar-label">{totals.cancelled}</span>
                </div>
              </div>
            </div>
          </article>

          <article className="parchment-wrapper">
            <div className="parchment-card">
              <div className="parchment-header">
                <Armchair size={14} />
                <span>Table Occupancy</span>
              </div>
              <div className="parchment-body">
                <div className="table-gauge-line">
                  <div className="gauge-item">
                    <div className="gauge-ring-container gauge-teal">
                      <div className="gauge-ring-inner">
                        <span className="gauge-number">{totals.vacantTables}</span>
                      </div>
                    </div>
                    <span className="gauge-label">Vacant</span>
                  </div>

                  <span className="gauge-dash">-</span>

                  <div className="gauge-item">
                    <div className="gauge-ring-container gauge-gold">
                      <div className="gauge-ring-inner">
                        <span className="gauge-number">{totals.reservedTables}</span>
                      </div>
                    </div>
                    <span className="gauge-label">Reserved</span>
                  </div>

                  <span className="dash-ops-total">Total Tables: {totals.totalTables}</span>
                </div>

                <div className="occupancy-bar" role="presentation">
                  <span className="occupancy-filled" style={{ width: `${totals.vacantPercent}%` }} />
                </div>
              </div>
            </div>
          </article>

          <article className="parchment-wrapper">
            <div className="parchment-card">
              <div className="parchment-header">
                <UtensilsCrossed size={14} />
                <span>Today&apos;s Best Menu</span>
              </div>
              <div className="parchment-body menu-empty-body">
                <Soup size={34} className="menu-empty-icon" />
                <p className="menu-empty-text">No menu items sold today</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
