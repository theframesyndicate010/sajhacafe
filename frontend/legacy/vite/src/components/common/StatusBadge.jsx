export default function StatusBadge({ value }) {
  const normalized = String(value || "").toLowerCase();
  const className = normalized === "active" || normalized === "paid" ? "badge-active" : "badge-inactive";

  return <span className={className}>{value}</span>;
}
