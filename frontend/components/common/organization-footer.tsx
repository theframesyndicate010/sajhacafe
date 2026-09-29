"use client";

export function OrganizationFooter() {
  return (
    <footer className="organization-powered-footer">
      <div className="organization-powered-footer-inner">
        <img
          alt="Frame Syndicate logo"
          className="organization-footer-logo"
          src="/frame.jpeg"
        />
        <span className="organization-footer-text">
          Copyright {new Date().getFullYear()}. Powered by The Frame Syndicate.
        </span>
      </div>
    </footer>
  );
}
