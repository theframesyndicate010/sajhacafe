export default function PageLoader({ message = "Loading... kripaya wait garnus" }) {
  return (
    <div className="state-wrap">
      <div className="state-card state-loading" role="status" aria-live="polite">
        <span className="state-loader-dot" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}