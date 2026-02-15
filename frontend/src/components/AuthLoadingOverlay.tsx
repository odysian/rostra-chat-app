import { useAuth } from "../context/AuthContext";
import { Info, RefreshCw } from "lucide-react";

export default function AuthLoadingOverlay() {
  const { isColdStart, authError, retryAuth } = useAuth();

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-50">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-zinc-950 to-zinc-950" />

      <div className="relative text-center">
        {/* Show spinner when loading, or error icon when failed */}
        {!authError ? (
          <div className="mb-6 flex justify-center">
            <div className="w-12 h-12 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="mb-6 flex justify-center">
            <div className="w-12 h-12 rounded-full border-3 border-amber-500/30 flex items-center justify-center">
              <RefreshCw size={24} className="text-amber-500" />
            </div>
          </div>
        )}

        {/* Logo */}
        <h1 className="text-4xl font-cinzel font-bold text-amber-500 tracking-wide mb-4">
          ROSTRA
        </h1>

        {/* Status message */}
        <div className="mb-2">
          <p className="text-zinc-100 text-lg font-medium">
            {authError ? "Server Unreachable" : "Connecting..."}
          </p>
        </div>

        {/* Error state: show message and retry button */}
        {authError && (
          <div className="mt-6 max-w-md mx-auto">
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-4">
              <div className="flex items-start gap-2 md:items-center">
                <Info size={16} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-amber-400 text-xs text-left">
                  {authError}
                </p>
              </div>
            </div>
            <button
              onClick={retryAuth}
              className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-medium rounded-lg transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Cold start notice while still loading */}
        {!authError && isColdStart && (
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg max-w-md mx-auto">
            <div className="flex items-start gap-2 md:items-center">
              <Info size={16} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-amber-400 text-xs">
              Initial requests may take up to a minute while servers start up.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
