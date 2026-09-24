import { useEffect, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { useLocation } from "react-router-dom";

import EmptyState from "../common/EmptyState.jsx";
import PageLoader from "../common/PageLoader.jsx";
import { getPageByPath } from "../../app/page-config.js";
import { useBusiness } from "../../context/useBusiness.js";
import PwaUpdatePrompt from "../common/PwaUpdatePrompt.jsx";
import Header from "./Header.jsx";
import Sidebar from "./Sidebar.jsx";

const MOBILE_BREAKPOINT = 768;

export default function AppShell() {
  const [isDesktopExpanded, setDesktopExpanded] = useState(true);
  const [isMobileOpen, setMobileOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const { loading, error, activeBusiness } = useBusiness();
  const location = useLocation();

  useEffect(() => {
    const onResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth > MOBILE_BREAKPOINT) {
        setMobileOpen(false);
      }
    };

    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const isMobile = useMemo(() => windowWidth <= MOBILE_BREAKPOINT, [windowWidth]);

  useEffect(() => {
    const page = getPageByPath(location.pathname);
    const pageTitle = page?.title || "Sajha Kitchen";
    const businessName = activeBusiness?.name ? ` | ${activeBusiness.name}` : "";

    document.title = `${pageTitle}${businessName} | Sajha Kitchen`;
  }, [activeBusiness?.name, location.pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setMobileOpen((previous) => !previous);
      return;
    }

    setDesktopExpanded((previous) => !previous);
  };

  const closeMobileSidebar = () => {
    setMobileOpen(false);
  };

  return (
    <div className="app-shell">
      <div
        aria-label="Sidebar overlay"
        className={`sidebar-overlay ${isMobileOpen ? "active" : ""}`}
        onClick={closeMobileSidebar}
      />

      <Sidebar
        isDesktopExpanded={isDesktopExpanded}
        isMobile={isMobile}
        isMobileOpen={isMobileOpen}
        onNavigate={closeMobileSidebar}
      />

      <main className="main-content">
        <Header onToggleSidebar={toggleSidebar} />

        <section className="dashboard-scroll">
          {loading ? <PageLoader message="Restaurant data load hudai cha..." /> : null}

          {!loading && error && (
            <div className="state-wrap">
              <EmptyState title="Restaurant data load bhayena" message={error} tone="error" />
            </div>
          )}

          {!loading && !error && <Outlet />}
        </section>
      </main>

      <PwaUpdatePrompt />
    </div>
  );
}
