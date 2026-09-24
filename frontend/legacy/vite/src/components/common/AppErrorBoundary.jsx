import { Component } from "react";

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Unexpected application error",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[frontend-error-boundary]", error, errorInfo);
  }

  handleTryAgain = () => {
    this.setState({ hasError: false, errorMessage: "" });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="state-wrap" style={{ minHeight: "100dvh", display: "grid", placeItems: "center" }}>
        <section className="content-card" style={{ width: "100%", maxWidth: 520 }}>
          <div className="content-card-body" style={{ padding: 22 }}>
            <h2 style={{ margin: 0, color: "#0f172a", fontSize: "1.2rem" }}>Something went wrong</h2>
            <p className="invoice-meta" style={{ marginTop: 8 }}>
              A runtime error occurred. You can retry without data loss or reload the app.
            </p>

            <div className="state-card state-error" style={{ marginTop: 10 }}>
              {this.state.errorMessage}
            </div>

            <div className="filter-toolbar" style={{ marginTop: 12 }}>
              <button className="page-header-btn" onClick={this.handleTryAgain} type="button">
                Try Again
              </button>
              <button className="btn-light" onClick={this.handleReload} type="button">
                Reload App
              </button>
            </div>
          </div>
        </section>
      </main>
    );
  }
}