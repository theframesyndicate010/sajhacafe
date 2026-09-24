export default function EmptyState({
  title,
  message,
  actionLabel,
  onAction,
  tone = "default",
}) {
  const className = tone === "error" ? "state-card state-error" : "state-card";

  return (
    <div className={className} role="status" aria-live="polite">
      {title ? <p className="state-card-title">{title}</p> : null}
      {message ? <p className="state-card-copy">{message}</p> : null}

      {actionLabel && onAction ? (
        <button className="icon-btn state-card-action" onClick={onAction} type="button">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
