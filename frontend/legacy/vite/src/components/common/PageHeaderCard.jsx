export default function PageHeaderCard({
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onActionClick,
  actionDisabled = false,
}) {
  return (
    <div className="page-header-card">
      <div className="page-header-card-body">
        <div>
          <h2 className="page-header-title">{title}</h2>
          {subtitle ? <p className="page-header-subtitle">{subtitle}</p> : null}
        </div>

        {actionLabel ? (
          <button
            className="page-header-btn"
            disabled={actionDisabled}
            onClick={onActionClick}
            type="button"
          >
            {actionIcon}
            <span>{actionLabel}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
