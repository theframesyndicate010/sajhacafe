"use client";

import { Banknote, Clock3, LogOut, Menu, ReceiptText } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { OrganizationFooter } from "@/components/common/organization-footer";
import { api } from "@/lib/api/client";
import { useAuth } from "@/lib/auth";

const items = [
  { href: "/cashier/pos", label: "POS", Icon: Banknote },
  { href: "/cashier/bills", label: "Bills", Icon: ReceiptText },
  { href: "/cashier/due-payments", label: "Due Payments", Icon: ReceiptText },
  { href: "/cashier/pending-payment", label: "Pending Payment", Icon: Clock3 },
] as const;

export function CashierLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [cashierName, setCashierName] = useState("Cashier");
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [cafeName, setCafeName] = useState("");
  const { user, isLoading: authLoading, error: authError, logout } = useAuth();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings.get, enabled: Boolean(user) });

  useEffect(() => { if (user) setCafeName(user.tenant.name); }, [user]);

  useEffect(() => { if (!authLoading && (authError || !user || user.role.toUpperCase() !== "CASHIER")) router.replace("/login"); else if (user) setCashierName(user.name); }, [authError, authLoading, router, user]);

  function logOut() {
    void logout();
    router.replace("/login");
  }

  if (authLoading || !user || user.role.toUpperCase() !== "CASHIER") return <main className="login"><p className="muted">Checking your session…</p></main>;

  return (
    <div className={`cashier-shell ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
      <aside className={`cashier-sidebar ${sidebarExpanded ? "expanded" : "collapsed"}`} id="cashier-sidebar">
        <div className="cashier-brand">{settings.data?.logo && <img alt={`${cafeName} logo`} height={40} src={settings.data.logo} width={40} />}{cafeName}<small>CASHIER</small></div>
        <nav aria-label="Cashier navigation">
          {items.map(({ href, label, Icon }) => (
            <Link aria-current={pathname === href ? "page" : undefined} className={pathname === href ? "active" : ""} href={href} key={href}>
              <Icon aria-hidden="true" size={18} /><span>{label}</span>
            </Link>
          ))}
        </nav>
        <button onClick={logOut} type="button"><LogOut aria-hidden="true" size={18} /><span>Logout</span></button>
      </aside>
      <main className="cashier-main">
        <header><button aria-label="Toggle navigation" aria-controls="cashier-sidebar" aria-expanded={sidebarExpanded} className="cashier-menu-toggle" onClick={() => setSidebarExpanded((expanded) => !expanded)} type="button"><Menu aria-hidden="true" size={20} /></button><strong>{cashierName}</strong><span>Cashier workspace</span></header>
        <section>{children}</section>
        <OrganizationFooter />
      </main>
    </div>
  );
}
