import { Component, type ErrorInfo, type ReactNode } from "react";
import { logError } from "../utils/logger";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReload?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError("Unhandled UI error:", error, errorInfo);
  }

  handleReload = () => {
    if (this.props.onReload) {
      this.props.onReload();
      return;
    }
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div
        className="min-h-dvh flex items-center justify-center px-6"
        style={{ background: "var(--bg-app)" }}
      >
        <div
          className="max-w-md w-full p-6"
          style={{
            border: "1px solid rgba(255, 68, 68, 0.35)",
            background: "rgba(255, 68, 68, 0.06)",
            color: "var(--color-primary)",
          }}
        >
          <h1 className="font-bebas text-[28px] tracking-[0.08em]">
            Something went wrong
          </h1>
          <p
            className="mt-2 font-mono text-[13px]"
            style={{ color: "var(--color-meta)" }}
          >
            An unexpected error interrupted the chat UI.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-5 w-full py-2 font-bebas text-[16px] tracking-[0.12em]"
            style={{
              border: "1px solid var(--border-primary)",
              background: "transparent",
              color: "var(--color-primary)",
            }}
          >
            RELOAD
          </button>
        </div>
      </div>
    );
  }
}
