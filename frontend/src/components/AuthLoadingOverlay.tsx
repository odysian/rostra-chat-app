import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Info, RefreshCw } from "lucide-react";

export default function AuthLoadingOverlay() {
  const { isColdStart, authError, retryAuth } = useAuth();
  const { theme } = useTheme();
  const noticeBackground =
    theme === "neon" ? "rgba(0, 240, 255, 0.05)" : "rgba(255, 191, 0, 0.08)";

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: "var(--bg-app)" }}
    >
      <div className="relative text-center">
        {/* Show spinner when loading, or error icon when failed */}
        {!authError ? (
          <div className="mb-6 flex justify-center">
            <div
              className="w-12 h-12 rounded-full animate-spin"
              style={{
                border: "3px solid var(--border-dim)",
                borderTopColor: "var(--color-primary)",
              }}
            />
          </div>
        ) : (
          <div className="mb-6 flex justify-center">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ border: "3px solid var(--border-primary)" }}
            >
              <RefreshCw size={24} style={{ color: "var(--color-primary)" }} />
            </div>
          </div>
        )}

        {/* Logo */}
        {theme === "neon" ? (
          <h1
            className="font-bebas text-[40px] tracking-[0.06em] mb-4 gradient-text"
            style={{
              backgroundImage:
                "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
            }}
          >
            ROSTRA
          </h1>
        ) : (
          <h1
            className="font-bebas text-[40px] tracking-[0.06em] mb-4"
            style={{
              color: "var(--color-primary)",
              textShadow: "var(--glow-primary)",
            }}
          >
            ROSTRA
          </h1>
        )}

        {/* Status message */}
        <div className="mb-2">
          <p className="font-mono text-[16px]" style={{ color: "var(--color-text)" }}>
            {authError ? "Server Unreachable" : "Connecting..."}
          </p>
        </div>

        {/* Error state: show message and retry button */}
        {authError && (
          <div className="mt-6 max-w-md mx-auto">
            <div
              className="p-4 mb-4"
              style={{
                background: noticeBackground,
                border: "1px solid var(--border-primary)",
              }}
            >
              <div className="flex items-start gap-2 md:items-center">
                <Info size={16} style={{ color: "var(--color-primary)" }} className="mt-0.5 shrink-0" />
                <p className="font-mono text-[12px] text-left" style={{ color: "var(--color-meta)" }}>
                  {authError}
                </p>
              </div>
            </div>
            <button
              onClick={retryAuth}
              className="px-6 py-2 font-bebas text-[16px] tracking-[0.10em] transition-colors cursor-pointer"
              style={{
                background: "var(--color-primary)",
                color: "#000",
              }}
            >
              TRY AGAIN
            </button>
          </div>
        )}

        {/* Cold start notice while still loading */}
        {!authError && isColdStart && (
          <div
            className="mt-6 p-4 max-w-md mx-auto"
            style={{
              background: noticeBackground,
              border: "1px solid var(--border-primary)",
            }}
          >
            <div className="flex items-start gap-2 md:items-center">
              <Info size={16} style={{ color: "var(--color-primary)" }} className="mt-0.5 shrink-0" />
              <p className="font-mono text-[12px]" style={{ color: "var(--color-meta)" }}>
                Initial requests may take up to a minute while servers start up.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
