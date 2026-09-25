"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  CircleDollarSign,
  ChefHat,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  TableProperties,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OrganizationFooter } from "@/components/common/organization-footer";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

const DRAWER_MAX_WIDTH = 1199;

const navigation = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/pos", "POS", ReceiptText],
  ["/bills", "Bills", ReceiptText],
  ["/kitchen", "Kitchen", ChefHat],
  ["/tables", "Tables", TableProperties],
  ["/menu/items", "Menu", Menu],
  ["/due-payments", "Due Payments", CircleDollarSign],
  ["/inventory", "Inventory", Package],
  ["/reports", "Reports", LayoutDashboard],
  ["/settings", "Settings", Settings],
  ["/users", "Users", Users],
] as const;

const topNavigation = [
  ["/dashboard", "Dashboard"],
  ["/pos", "POS"],
  ["/kitchen", "Kitchen"],
  ["/reports", "Reports"],
] as const;

export default function CafeLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "";
  const router = useRouter();
  const [expanded, setExpanded] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDrawerViewport, setIsDrawerViewport] = useState(false);
  const [cafeName, setCafeName] = useState("");
  const { user, isLoading: authLoading, error: authError, logout, switchTenant } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings.get, enabled: Boolean(user) });

  useEffect(() => {
    if (!authLoading && (authError || !user)) router.replace("/login");
    else if (user?.role.toUpperCase() === "WAITER") router.replace("/waiter");
    else if (user?.role.toUpperCase() === "CASHIER") router.replace("/cashier");
  }, [authError, authLoading, router, user]);

  const toggleSidebar = () => {
    if (window.matchMedia(`(max-width: ${DRAWER_MAX_WIDTH}px)`).matches) {
      setMobileOpen((isOpen) => !isOpen);
      return;
    }

    setExpanded((isExpanded) => !isExpanded);
  };

  useEffect(() => {
    const drawerQuery = window.matchMedia(`(max-width: ${DRAWER_MAX_WIDTH}px)`);
    const closeDrawer = () => setMobileOpen(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    const onBreakpointChange = (event: MediaQueryListEvent) => {
      setIsDrawerViewport(event.matches);
      if (!event.matches) closeDrawer();
    };

    setIsDrawerViewport(drawerQuery.matches);
    drawerQuery.addEventListener("change", onBreakpointChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      drawerQuery.removeEventListener("change", onBreakpointChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => { if (user) setCafeName(user.tenant.name); }, [user]);

  if (authLoading || !user) return <main className="login"><p className="muted">Checking your session…</p></main>;

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          aria-label="Close navigation menu"
          className="sidebar-overlay active"
          onClick={() => setMobileOpen(false)}
          type="button"
        />
      )}

      <aside className={`sidebar ${expanded ? "expanded" : ""} ${mobileOpen ? "mobile-open" : ""}`} id="cafe-sidebar">
        <div className="sidebar-brand">
          <div className="brand-box">
            {settings.data?.logo ? <img alt={`${cafeName} logo`} height={42} src={settings.data.logo} width={42} /> : <Image alt={cafeName} height={42} priority src="/logo.png" width={42} />}
          </div>
          <h4 className="nav-text">{cafeName}</h4>
        </div>

        <nav className="sidebar-menu">
          {navigation.filter(([href]) => href !== "/users" || user.permissions.includes("users.manage")).map(([href, label, Icon]) => (
            <Link
              className={`nav-link ${pathname.startsWith(href) ? "active" : ""} ${!expanded ? "collapsed" : ""}`}
              data-tooltip={label}
              href={href}
              key={href}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} />
              <span className="nav-text">{label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="nav-link nav-link-btn" onClick={async () => { setMobileOpen(false); await logout(); router.replace("/login"); }} type="button">
            <LogOut size={18} />
            <span className="nav-text">Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="header-left">
            <button
              aria-label="Toggle sidebar"
              aria-controls="cafe-sidebar"
              aria-expanded={isDrawerViewport ? mobileOpen : expanded}
              className="icon-btn"
              onClick={toggleSidebar}
              type="button"
            >
              <Menu size={17} />
            </button>
          </div>

          <nav className="header-tabs">
            {topNavigation.map(([href, label]) => (
              <Link className={`nav-tab ${pathname.startsWith(href) ? "active-tab" : ""}`} href={href} key={href}>
                {label}
              </Link>
            ))}
          </nav>

          <div className="header-actions">
            <Bell size={18} />
            {user.memberships && user.memberships.length > 1 ? (
              <select aria-label="Active cafe" value={user.tenant.id} onChange={(event) => void switchTenant(event.target.value)}>
                {user.memberships.map((membership) => <option key={membership.tenant.id} value={membership.tenant.id}>{membership.tenant.name}</option>)}
              </select>
            ) : <span className="invoice-meta">{user.tenant.name || cafeName}</span>}
          </div>
        </header>

        <section className="dashboard-scroll">
          <div className="cafe-page">{children}</div>
        </section>
        <OrganizationFooter />
      </main>
    </div>
  );
}
