import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ChevronDown, LogOut } from "lucide-react";
import { sidebarNavigation } from "../../app/page-config.js";

function SidebarItem({ item, isCollapsed, onNavigate }) {
  const location = useLocation();
  const Icon = item.icon;
  const [pathname, search = ""] = item.to.split("?");
  const isActive = location.pathname === pathname && location.search === (search ? `?${search}` : "");

  return (
    <li className="nav-item">
      <NavLink
        end={item.exact}
        to={item.to}
        onClick={onNavigate}
        aria-label={item.label}
        data-tooltip={item.label}
        className={`nav-link ${isActive ? "active" : ""} ${isCollapsed ? "collapsed" : ""}`}
      >
        <Icon size={18} strokeWidth={2.2} />
        <span className="nav-text">{item.label}</span>
      </NavLink>
    </li>
  );
}

export default function Sidebar({ isDesktopExpanded, isMobile, isMobileOpen, onNavigate }) {
  const location = useLocation();
  const defaultOpenGroups = useMemo(
    () => new Set(sidebarNavigation.filter((group) => group.items).map((group) => group.label)),
    []
  );
  const [openGroups, setOpenGroups] = useState(() => new Set(defaultOpenGroups));

  const handleLogout = () => {
    localStorage.removeItem("sajha-karobar-active-business");
    window.location.assign("/");
  };

  const isExpanded = useMemo(() => {
    if (isMobile) {
      return isMobileOpen;
    }

    return isDesktopExpanded;
  }, [isDesktopExpanded, isMobile, isMobileOpen]);

  useEffect(() => {
    const activeGroup = sidebarNavigation.find((group) => {
      if (!group.items) {
        return false;
      }

      return group.items.some((item) => {
        const [itemPath, itemSearch = ""] = item.to.split("?");
        const isSamePath = location.pathname === itemPath;
        const expectedSearch = itemSearch ? `?${itemSearch}` : "";
        return isSamePath && location.search === expectedSearch;
      });
    });

    if (activeGroup) {
      setOpenGroups((previous) => {
        const next = new Set(previous);
        next.add(activeGroup.label);
        return next;
      });
    }
  }, [location.pathname, location.search]);

  const toggleGroup = (label) => {
    setOpenGroups((previous) => {
      const next = new Set(previous);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  return (
    <aside className={`sidebar ${isExpanded ? "expanded" : ""} ${isMobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand">
        <div className="brand-box">
          <img src="/logo.png" alt="Sajha Kitchen" />
        </div>
        <h4 className="nav-text">Sajha Kitchen</h4>
      </div>

      <ul className="sidebar-menu">
        {sidebarNavigation.map((group) => {
          const GroupIcon = group.icon;
          if (!group.items) {
            return <SidebarItem key={group.to} isCollapsed={!isExpanded} item={group} onNavigate={onNavigate} />;
          }

          const isOpen = openGroups.has(group.label);
          return (
            <li className="sidebar-nav-group" key={group.label}>
              <button
                aria-controls={`sidebar-group-${group.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`}
                aria-expanded={isOpen}
                className="sidebar-group-title"
                onClick={() => toggleGroup(group.label)}
                type="button"
              >
                <GroupIcon size={17} strokeWidth={2.2} />
                <span className="nav-text">{group.label}</span>
                <ChevronDown className={`sidebar-group-chevron ${isOpen ? "open" : ""}`} size={15} />
              </button>
              {isOpen ? (
                <ul id={`sidebar-group-${group.label.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`} className="sidebar-submenu">
                  {group.items.map((item) => (
                    <SidebarItem key={item.to} isCollapsed={!isExpanded} item={{ ...item, icon: GroupIcon }} onNavigate={onNavigate} />
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="sidebar-footer">
        <button
          aria-label="Logout"
          className={`nav-link nav-link-btn ${!isExpanded ? "collapsed" : ""}`}
          data-tooltip="Logout"
          onClick={() => {
            if (onNavigate) {
              onNavigate();
            }
            handleLogout();
          }}
          type="button"
        >
          <LogOut size={18} strokeWidth={2.2} />
          <span className="nav-text">Logout</span>
        </button>
      </div>
    </aside>
  );
}
