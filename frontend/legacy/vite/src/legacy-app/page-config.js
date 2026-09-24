import {
  CreditCard,
  ChefHat,
  ClipboardList,
  LayoutDashboard,
  Receipt,
  ShoppingBasket,
  ShoppingCart,
  TableProperties,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";

export const pageRouteConfig = [
  {
    key: "dashboard",
    path: "dashboard",
    component: "dashboard",
    title: "Dashboard",
    navLabel: "Dashboard",
    icon: LayoutDashboard,
    showInSidebar: true,
    showInTopTabs: true,
  },
  {
    key: "billing",
    path: "billing",
    component: "billing",
    title: "Order Desk",
    navLabel: "Order Desk",
    icon: CreditCard,
    showInSidebar: true,
    showInTopTabs: true,
  },
  {
    key: "stock",
    path: "stock",
    component: "stock",
    title: "Kitchen Stock",
    navLabel: "Kitchen Stock",
    icon: ShoppingBasket,
    showInSidebar: true,
    showInTopTabs: false,
  },
  {
    key: "sales",
    path: "sales",
    component: "sales",
    title: "Order History",
    navLabel: "Order History",
    topTabLabel: "Orders",
    icon: ShoppingCart,
    showInSidebar: true,
    showInTopTabs: true,
  },
  {
    key: "reports",
    path: "reports",
    component: "reports",
    title: "Restaurant Reports",
    navLabel: "Reports",
    topTabLabel: "Reports",
    icon: TrendingUp,
    showInSidebar: true,
    showInTopTabs: true,
  },
  {
    key: "buying",
    path: "buying",
    component: "buying",
    title: "Supplier & Expenses",
    navLabel: "Suppliers",
    icon: WalletCards,
    showInSidebar: true,
    showInTopTabs: true,
  },
  {
    key: "buying-add",
    path: "buying/add",
    component: "addTransaction",
    title: "Add Supplier Purchase",
    showInSidebar: false,
    showInTopTabs: false,
  },
  {
    key: "invoices",
    path: "invoices",
    component: "invoices",
    title: "Receipts",
    navLabel: "Receipts",
    icon: Receipt,
    showInSidebar: true,
    showInTopTabs: true,
  },
  {
    key: "invoice-detail",
    path: "invoices/:invoiceId",
    component: "invoiceDetail",
    title: "Receipt Detail",
    showInSidebar: false,
    showInTopTabs: false,
  },
];

export const routeRedirects = [
  { path: "transactions", to: "/buying" },
  { path: "transactions/add", to: "/buying/add" },
];

// Restaurant navigation is grouped around daily service workflows. Query values
// preserve the selected context in the URL while the current static screens act
// as the shared workspace for each group.
export const sidebarNavigation = [
  { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  {
    label: "POS / New Order",
    icon: CreditCard,
    items: [
      { label: "New Order", to: "/billing" },
      { label: "Dine-In", to: "/billing?type=dine-in" },
      { label: "Takeaway", to: "/billing?type=takeaway" },
      { label: "Delivery", to: "/billing?type=delivery" },
    ],
  },
  {
    label: "Orders",
    icon: ClipboardList,
    items: [
      { label: "All Orders", to: "/sales" },
      { label: "Pending", to: "/sales?status=pending" },
      { label: "Preparing", to: "/sales?status=preparing" },
      { label: "Completed", to: "/sales?status=completed" },
      { label: "Cancelled", to: "/sales?status=cancelled" },
      { label: "Refunded", to: "/sales?status=refunded" },
    ],
  },
  {
    label: "Kitchen",
    icon: ChefHat,
    items: [
      { label: "Kitchen Orders", to: "/stock" },
      { label: "Pending", to: "/stock?status=pending" },
      { label: "Preparing", to: "/stock?status=preparing" },
      { label: "Completed", to: "/stock?status=completed" },
    ],
  },
  { label: "Tables", icon: TableProperties, items: [{ label: "Table Overview", to: "/dashboard?view=tables" }, { label: "Manage Tables", to: "/dashboard?view=manage-tables" }] },
  { label: "Menu", icon: ShoppingBasket, items: [{ label: "Food Items", to: "/stock?view=food-items" }, { label: "Categories", to: "/stock?view=categories" }, { label: "Manage Menu", to: "/stock?view=manage-menu" }] },
  { label: "Customers", icon: Users, items: [{ label: "All Customers", to: "/invoices?view=customers" }, { label: "Customer History", to: "/invoices?view=history" }, { label: "Due Customers", to: "/invoices?view=due" }, { label: "Customer Statements", to: "/invoices?view=statements" }] },
  { label: "Expenses", icon: WalletCards, items: [{ label: "All Expenses", to: "/buying" }, { label: "Add Expense", to: "/buying/add" }] },
  { label: "Reports", icon: TrendingUp, items: [{ label: "Sales Report", to: "/reports?type=sales" }, { label: "Purchase Report", to: "/reports?type=purchase" }, { label: "Expense Report", to: "/reports?type=expense" }, { label: "Payment Report", to: "/reports?type=payment" }, { label: "Customer Report", to: "/reports?type=customer" }, { label: "Download Reports", to: "/reports?type=download" }] },
];

export const topTabNavigation = pageRouteConfig
  .filter((entry) => entry.showInTopTabs)
  .map((entry) => ({
    label: entry.topTabLabel || entry.navLabel || entry.title,
    to: `/${entry.path}`,
  }));

function escapeRegexText(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildRouteRegex(path) {
  const escaped = escapeRegexText(path);
  const withDynamicSegments = escaped.replace(/:[^/]+/g, "[^/]+");
  return new RegExp(`^/${withDynamicSegments}$`);
}

const routeMatchers = pageRouteConfig.map((entry) => ({
  ...entry,
  regex: buildRouteRegex(entry.path),
}));

export function getPageByPath(pathname) {
  if (!pathname) {
    return null;
  }

  const normalizedPath = pathname === "/" ? "/dashboard" : pathname.replace(/\/+$/, "") || "/";
  return routeMatchers.find((entry) => entry.regex.test(normalizedPath)) || null;
}
