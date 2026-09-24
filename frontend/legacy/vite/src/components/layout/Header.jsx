import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { LogOut, Menu, UserCircle2 } from "lucide-react";

import { topTabNavigation } from "../../app/page-config.js";
import { useBusiness } from "../../context/useBusiness.js";

export default function Header({ onToggleSidebar }) {
  const { activeBusiness } = useBusiness();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("sajha-karobar-active-business");
    window.location.assign("/");
  };

  const displayName = activeBusiness?.name || "Sajha Kitchen & Cafe";

  return (
    <header className="topbar">
      <div className="header-left">
        <button className="icon-btn" onClick={onToggleSidebar} type="button">
          <Menu size={17} />
        </button>
      </div>

      <nav className="header-tabs" aria-label="Header navigation tabs">
        {topTabNavigation.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `nav-tab ${isActive ? "active-tab" : ""}`}
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <div className="header-actions">
        <span className="invoice-meta">{activeBusiness?.name || "Restaurant select garnus"}</span>
        <div className="profile-wrap" ref={profileRef}>
          <button
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
            aria-label="Open profile menu"
            className="profile-trigger"
            onClick={() => setIsProfileOpen((previous) => !previous)}
            type="button"
          >
            <UserCircle2 size={18} />
          </button>
          <div className={`profile-popup ${isProfileOpen ? "show" : ""}`} role="menu">
            <div className="popup-header">
              <div className="popup-avatar">
                <UserCircle2 size={20} />
              </div>
              <h6>{displayName}</h6>
              <p>Profile</p>
            </div>
            <div className="popup-footer">
              <button onClick={handleLogout} type="button">
                <LogOut size={16} /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
