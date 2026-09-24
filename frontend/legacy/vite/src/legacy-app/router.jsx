import { Suspense, lazy } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";

import PageLoader from "../components/common/PageLoader.jsx";
import { pageRouteConfig, routeRedirects } from "./page-config.js";

const AppShell = lazy(() => import("../components/layout/AppShell.jsx"));
const AddTransactionPage = lazy(() => import("../pages/AddTransactionPage.jsx"));
const BillingPage = lazy(() => import("../pages/BillingPage.jsx"));
const DashboardPage = lazy(() => import("../pages/DashboardPage.jsx"));
const InvoiceDetailPage = lazy(() => import("../pages/InvoiceDetailPage.jsx"));
const InvoicesPage = lazy(() => import("../pages/InvoicesPage.jsx"));
const NotFoundPage = lazy(() => import("../pages/NotFoundPage.jsx"));
const ReportsPage = lazy(() => import("../pages/ReportsPage.jsx"));
const SalesPage = lazy(() => import("../pages/SalesPage.jsx"));
const StockPage = lazy(() => import("../pages/StockPage.jsx"));
const BuyingPage = lazy(() => import("../pages/TransactionsPage.jsx"));

function withPageLoader(node) {
  return <Suspense fallback={<PageLoader message="Loading page..." />}>{node}</Suspense>;
}

const pageComponents = {
  dashboard: DashboardPage,
  sales: SalesPage,
  stock: StockPage,
  billing: BillingPage,
  invoices: InvoicesPage,
  invoiceDetail: InvoiceDetailPage,
  buying: BuyingPage,
  addTransaction: AddTransactionPage,
  reports: ReportsPage,
};

function createRouteElement(componentKey) {
  const Component = pageComponents[componentKey];
  return withPageLoader(<Component />);
}

const router = createBrowserRouter([
  {
    path: "/",
    element: withPageLoader(<AppShell />),
    children: [
      {
        index: true,
        element: <Navigate to="/dashboard" replace />,
      },
      ...pageRouteConfig.map((entry) => ({
        path: entry.path,
        element: createRouteElement(entry.component),
      })),
      ...routeRedirects.map((redirect) => ({
        path: redirect.path,
        element: <Navigate to={redirect.to} replace />,
      })),
    ],
  },
  {
    path: "*",
    element: withPageLoader(<NotFoundPage />),
  },
]);

export default function AppRouter() {
  return <RouterProvider router={router} fallbackElement={<PageLoader message="Preparing route..." />} />;
}
