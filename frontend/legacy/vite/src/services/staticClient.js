import initialData from "../../../backend/data/db.json";

const STORE_KEY = "sajha-karobar-restaurant-data-v2";

const clone = (value) => JSON.parse(JSON.stringify(value));
const money = (value) => Number((Number(value) || 0).toFixed(2));
const makeId = (prefix) => `${prefix}-${crypto.randomUUID?.().slice(0, 8) || Math.random().toString(36).slice(2, 10)}`;

const restaurantBusiness = {
  ...initialData.businesses.find((business) => business.type === "restaurant"),
  name: "Sajha Kitchen & Cafe",
};

const now = new Date();
const earlierToday = new Date(now.getTime() - 1000 * 60 * 90).toISOString();
const yesterday = new Date(now.getTime() - 1000 * 60 * 60 * 24).toISOString();
const restaurantInvoices = [
  { id: "inv-demo-001", businessId: restaurantBusiness.id, invoiceNumber: "REC-DEMO-001", customerName: "Table 4", discountType: "flat", discountValue: 0, taxRate: 0, subtotal: 620, discountAmount: 0, taxAmount: 0, total: 620, lineItems: [{ id: "ln-demo-001", itemId: "menu-001", name: "Chicken Momo", quantity: 2, rate: 220, total: 440 }, { id: "ln-demo-002", itemId: "menu-005", name: "Mocha Coffee", quantity: 1, rate: 180, total: 180 }], paymentMethod: "Cash", status: "paid", createdAt: earlierToday, notes: "" },
  { id: "inv-demo-002", businessId: restaurantBusiness.id, invoiceNumber: "REC-DEMO-002", customerName: "Takeaway", discountType: "flat", discountValue: 0, taxRate: 0, subtotal: 650, discountAmount: 0, taxAmount: 0, total: 650, lineItems: [{ id: "ln-demo-003", itemId: "menu-004", name: "Butter Chicken with Rice", quantity: 1, rate: 520, total: 520 }, { id: "ln-demo-004", itemId: "menu-006", name: "Fresh Lemon Soda", quantity: 1, rate: 130, total: 130 }], paymentMethod: "E-Payment", status: "paid", createdAt: yesterday, notes: "" },
];

const restaurantSeed = {
  businesses: [restaurantBusiness],
  catalogItems: [
    { id: "menu-001", businessType: "restaurant", name: "Chicken Momo", category: "Momo", price: 220, sku: "MOMO-001", quantity: 40 },
    { id: "menu-002", businessType: "restaurant", name: "Veg Chowmein", category: "Noodles", price: 190, sku: "NOOD-001", quantity: 28 },
    { id: "menu-003", businessType: "restaurant", name: "Paneer Sizzler", category: "Main Course", price: 480, sku: "MAIN-001", quantity: 12 },
    { id: "menu-004", businessType: "restaurant", name: "Butter Chicken with Rice", category: "Main Course", price: 520, sku: "MAIN-002", quantity: 16 },
    { id: "menu-005", businessType: "restaurant", name: "Mocha Coffee", category: "Beverages", price: 180, sku: "BEV-001", quantity: 35 },
    { id: "menu-006", businessType: "restaurant", name: "Fresh Lemon Soda", category: "Beverages", price: 130, sku: "BEV-002", quantity: 50 },
  ],
  invoices: restaurantInvoices,
  sales: restaurantInvoices.map((invoice) => ({ id: `sale-${invoice.id}`, businessId: invoice.businessId, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, itemsCount: invoice.lineItems.reduce((total, line) => total + line.quantity, 0), netAmount: invoice.total, paymentMethod: invoice.paymentMethod, createdAt: invoice.createdAt })),
  transactions: [
    ...restaurantInvoices.map((invoice) => ({ id: `txn-${invoice.id}`, businessId: invoice.businessId, type: "incoming", category: "restaurant sale", referenceId: invoice.id, description: `Receipt ${invoice.invoiceNumber}`, amount: invoice.total, paymentMethod: invoice.paymentMethod, createdAt: invoice.createdAt })),
    { id: "txn-demo-supplier", businessId: restaurantBusiness.id, type: "outgoing", category: "vegetables", itemName: "Fresh vegetables", description: "Morning supplier purchase", amount: 1850, paymentMethod: "Cash", createdAt: earlierToday },
  ],
};

function readState() {
  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // Start fresh if an older or malformed local value is present.
  }
  const state = clone(restaurantSeed);
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  return state;
}

function updateState(mutator) {
  const state = readState();
  const result = mutator(state);
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  return result;
}

function businessOrThrow(state, businessId) {
  const business = state.businesses.find((entry) => entry.id === businessId);
  if (!business) throw new Error("Business not found");
  return business;
}

function byNewest(rows) {
  return [...rows].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function sameDay(a, b = new Date()) {
  const date = new Date(a);
  return date.getFullYear() === b.getFullYear() && date.getMonth() === b.getMonth() && date.getDate() === b.getDate();
}

function sum(rows, key) {
  return money(rows.reduce((total, row) => total + Number(row[key] || 0), 0));
}

function series(sales, period, valueKey) {
  const grouped = sales.reduce((result, sale) => {
    const date = new Date(sale.createdAt);
    let label;
    if (period === "weekly") {
      const start = new Date(date);
      start.setDate(date.getDate() - date.getDay());
      label = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } else if (period === "yearly") {
      label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    } else {
      label = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    result[label] = (result[label] || 0) + (valueKey === "count" ? 1 : Number(sale[valueKey] || 0));
    return result;
  }, {});
  return Object.entries(grouped).map(([label, value]) => ({ label, [valueKey === "netAmount" ? "revenue" : "count"]: money(value) })).sort((a, b) => a.label.localeCompare(b.label));
}

function snapshot(state, businessId) {
  const sales = state.sales.filter((row) => row.businessId === businessId);
  const invoices = state.invoices.filter((row) => row.businessId === businessId);
  const transactions = state.transactions.filter((row) => row.businessId === businessId);
  const todaySales = sales.filter((row) => sameDay(row.createdAt));
  const incoming = transactions.filter((row) => row.type === "incoming");
  const outgoing = transactions.filter((row) => row.type === "outgoing");
  const paymentMethods = ["Cash", "Card", "E-Payment", "Credit", "PhonePe"];
  return {
    totalRevenue: sum(sales, "netAmount"), totalIncoming: sum(incoming, "amount"), totalOutgoing: sum(outgoing, "amount"),
    netCashflow: money(sum(incoming, "amount") - sum(outgoing, "amount")), totalInvoices: invoices.length, totalSalesCount: sales.length,
    todaySalesAmount: sum(todaySales, "netAmount"), todayIncoming: sum(incoming.filter((row) => sameDay(row.createdAt)), "amount"),
    todayOutgoing: sum(outgoing.filter((row) => sameDay(row.createdAt)), "amount"),
    avgInvoiceValue: invoices.length ? money(sum(invoices, "total") / invoices.length) : 0,
    paymentBreakdown: paymentMethods.map((method) => ({ method, amount: sum(todaySales.filter((row) => row.paymentMethod === method), "netAmount") })),
  };
}

function invoiceTotals(payload) {
  const lineItems = (payload.lineItems || []).filter((item) => item?.name).map((item) => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const rate = money(item.rate);
    return { id: makeId("ln"), itemId: item.itemId || null, name: item.name, quantity, rate, total: money(quantity * rate) };
  });
  const subtotal = sum(lineItems, "total");
  const discountValue = money(payload.discountValue);
  const discountAmount = Math.min(subtotal, payload.discountType === "percent" ? money(subtotal * discountValue / 100) : discountValue);
  const taxAmount = money((subtotal - discountAmount) * money(payload.taxRate) / 100);
  return { lineItems, subtotal, discountAmount, taxAmount, total: money(subtotal - discountAmount + taxAmount) };
}

export const staticClient = {
  getBusinesses: async () => ({ data: [...readState().businesses].sort((a, b) => a.name.localeCompare(b.name)) }),
  getHealth: async () => ({ provider: "static" }),
  getPreferences: async () => ({ data: {} }),
  updatePreferences: async (payload) => ({ data: payload }),
  getCatalog: async (businessId, params = {}) => {
    const state = readState(); const business = businessOrThrow(state, businessId);
    const search = String(params.search || "").toLowerCase().trim(); const category = String(params.category || "all").toLowerCase();
    let data = state.catalogItems.filter((item) => item.businessType === "all" || item.businessType === business.type);
    if (category !== "all") data = data.filter((item) => item.category.toLowerCase() === category);
    if (search) data = data.filter((item) => item.name.toLowerCase().includes(search) || item.sku.toLowerCase().includes(search));
    return { data: data.map((item) => ({ ...item, quantity: Math.max(0, Math.floor(Number(item.quantity || 0))) })), meta: { categories: ["all", ...new Set(data.map((item) => item.category.toLowerCase()))], businessType: business.type } };
  },
  createCatalogItem: async (payload) => updateState((state) => {
    const business = businessOrThrow(state, payload.businessId); const name = String(payload.name || "").trim(); const category = String(payload.category || "").trim();
    if (!name || !category || Number(payload.price) <= 0 || Number(payload.quantity) < 0) throw new Error("Enter a valid item, category, price, and quantity.");
    const existing = state.catalogItems.find((item) => item.businessType === business.type && item.name.toLowerCase() === name.toLowerCase() && item.category.toLowerCase() === category.toLowerCase());
    if (existing) { existing.price = money(payload.price); existing.quantity = Math.max(0, Math.floor(Number(existing.quantity || 0) + Number(payload.quantity || 0))); if (payload.sku) existing.sku = String(payload.sku).toUpperCase(); return { data: existing }; }
    const data = { id: makeId("item"), businessType: business.type, name, category, price: money(payload.price), quantity: Math.floor(Number(payload.quantity || 0)), sku: String(payload.sku || `${business.type.slice(0, 3)}-${Date.now().toString().slice(-6)}`).toUpperCase() };
    state.catalogItems.push(data); return { data };
  }),
  getDashboard: async (businessId) => { const state = readState(); const business = businessOrThrow(state, businessId); const sales = state.sales.filter((row) => row.businessId === businessId); return { data: { snapshot: snapshot(state, businessId), business, recentInvoices: byNewest(state.invoices.filter((row) => row.businessId === businessId)).slice(0, 5), ordersSeries: series(sales, "weekly", "count"), revenueSeries: series(sales, "monthly", "netAmount"), transactionCount: state.transactions.filter((row) => row.businessId === businessId).length } }; },
  getInvoices: async (businessId) => { const state = readState(); businessOrThrow(state, businessId); return { data: byNewest(state.invoices.filter((row) => row.businessId === businessId)) }; },
  getInvoiceById: async (invoiceId) => { const data = readState().invoices.find((row) => row.id === invoiceId); if (!data) throw new Error("Invoice not found"); return { data }; },
  createInvoice: async (payload) => updateState((state) => {
    const business = businessOrThrow(state, payload.businessId); const totals = invoiceTotals(payload); if (!totals.lineItems.length) throw new Error("Add at least one item before checkout.");
    const now = new Date(); const serial = state.invoices.filter((entry) => sameDay(entry.createdAt, now)).length + 1;
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(serial).padStart(3, "0")}`;
    const data = { id: makeId("inv"), businessId: business.id, invoiceNumber, customerName: payload.customerName || "Walk-in Customer", discountType: payload.discountType || "flat", discountValue: money(payload.discountValue), taxRate: money(payload.taxRate), ...totals, paymentMethod: payload.paymentMethod || "Cash", status: "paid", createdAt: now.toISOString(), notes: payload.notes || "" };
    state.invoices.push(data); state.sales.push({ id: makeId("sale"), businessId: business.id, invoiceId: data.id, invoiceNumber, itemsCount: totals.lineItems.reduce((total, item) => total + item.quantity, 0), netAmount: data.total, paymentMethod: data.paymentMethod, createdAt: data.createdAt });
    state.transactions.push({ id: makeId("txn"), businessId: business.id, type: "incoming", category: "sale", referenceId: data.id, description: `Invoice ${invoiceNumber}`, amount: data.total, paymentMethod: data.paymentMethod, createdAt: data.createdAt });
    totals.lineItems.forEach((line) => { const item = state.catalogItems.find((entry) => entry.id === line.itemId && entry.businessType === business.type); if (item) item.quantity = Math.max(0, Math.floor(Number(item.quantity || 0)) - Math.floor(line.quantity)); });
    return { data };
  }),
  getSales: async (businessId) => { const state = readState(); businessOrThrow(state, businessId); return { data: byNewest(state.sales.filter((row) => row.businessId === businessId)) }; },
  getTransactions: async (businessId, type = "") => { const state = readState(); businessOrThrow(state, businessId); return { data: byNewest(state.transactions.filter((row) => row.businessId === businessId && (!type || row.type === type))) }; },
  createTransaction: async (payload) => updateState((state) => { businessOrThrow(state, payload.businessId); const amount = money(payload.amount); if (amount <= 0) throw new Error("Amount must be greater than 0"); const data = { id: makeId("txn"), businessId: payload.businessId, type: payload.type === "outgoing" ? "outgoing" : "incoming", category: payload.category || "general", referenceId: payload.referenceId || null, itemName: payload.itemName || null, description: payload.description || "Manual transaction", amount, paymentMethod: payload.paymentMethod || "Cash", createdAt: payload.createdAt || new Date().toISOString() }; state.transactions.push(data); return { data }; }),
  getReportSummary: async (businessId) => { const state = readState(); businessOrThrow(state, businessId); return { data: snapshot(state, businessId) }; },
  getRevenueReport: async (businessId, period = "monthly") => { const state = readState(); businessOrThrow(state, businessId); const normalized = ["weekly", "monthly", "yearly"].includes(period) ? period : "monthly"; return { data: { period: normalized, revenueSeries: series(state.sales.filter((row) => row.businessId === businessId), normalized, "netAmount") } }; },
};
