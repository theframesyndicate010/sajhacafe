"use client";

import {
  ClipboardList,
  Menu,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OrganizationFooter } from "@/components/common/organization-footer";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

const navigationItems = [
  { href: "/waiter", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/waiter/orders", label: "Orders", Icon: ClipboardList },
  { href: "/waiter/bills", label: "Bills", Icon: ReceiptText },
  { href: "/waiter/profile", label: "Profile", Icon: UserRound },
] as const;

export function WaiterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [waiterName, setWaiterName] = useState("Waiter");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const { user, isLoading: authLoading, error: authError, logout } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings.get, enabled: Boolean(user) });
  const cafeName = settings.data?.businessName ?? user?.tenant.name ?? "";

  useEffect(() => {
    if (!authLoading && (authError || !user || user.role.toUpperCase() !== "WAITER")) router.replace("/login");
    else if (user) setWaiterName(user.name);
  }, [authError, authLoading, router, user]);

  function logOut() {
    void logout();
    router.replace("/login");
  }

  if (authLoading || !user || user.role.toUpperCase() !== "WAITER") return <main className="login"><p className="muted">Checking your session…</p></main>;

  return (
    <div className={`waiter-shell ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
      <aside className={`waiter-sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`} id="waiter-sidebar">
        <div className="waiter-brand">
          {settings.data?.logo && <img key={settings.data.logo} alt={`${cafeName} logo`} height={40} src={settings.data.logo} width={40} />}
          {cafeName}
          <small>WAITER</small>
        </div>

        <nav aria-label="Waiter navigation">
          {navigationItems.map(({ href, label, Icon }) => (
            <Link
              aria-current={pathname === href ? "page" : undefined}
              className={pathname === href ? "active" : ""}
              href={href}
              key={href}
            >
              <Icon aria-hidden="true" size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>

        <button onClick={logOut} type="button">
          <LogOut aria-hidden="true" size={18} />
          <span>Logout</span>
        </button>
      </aside>

      <main className="waiter-main">
        <header>
          <button aria-label="Toggle navigation" aria-controls="waiter-sidebar" aria-expanded={sidebarExpanded} className="waiter-menu-toggle" onClick={() => setSidebarExpanded((expanded) => !expanded)} type="button">
            <Menu aria-hidden="true" size={20} />
          </button>
          <strong>{waiterName}</strong>
          <span>Waiter workspace</span>
        </header>

        <section>{children}</section>
        <OrganizationFooter />
      </main>
    </div>
  );
}
