import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#eef2f7",
        padding: 16,
      }}
    >
      <section className="content-card" style={{ maxWidth: 420, width: "100%" }}>
        <div className="content-card-body" style={{ textAlign: "center", padding: 28 }}>
          <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#0f172a" }}>Page Not Found</h2>
          <p className="invoice-meta" style={{ marginTop: 8 }}>
            The page you are trying to access does not exist.
          </p>
          <Link className="page-header-btn" style={{ marginTop: 18, display: "inline-flex" }} to="/">
            Go to Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
