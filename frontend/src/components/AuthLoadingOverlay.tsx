import { useAuth } from "../context/AuthContext";

export default function AuthLoadingOverlay() {
  const { isColdStart } = useAuth();

  const getMessage = () => {
    if (isColdStart) {
      return "Server waking up (2-3 min delay)";
    }
    return "Connecting...";
  };

  const getSubMessage = () => {
    if (isColdStart) {
      return "This app runs on a free tier and may take a few minutes to start up";
    }
    return "Validating your authentication";
  };

  return (
    <div className="fixed inset-0 bg-zinc-950 flex items-center justify-center z-50">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/10 via-zinc-950 to-zinc-950" />

      <div className="relative text-center">
        {/* Loading Spinner */}
        <div className="mb-6 flex justify-center">
          <div className="w-12 h-12 border-3 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
        </div>

        {/* Logo */}
        <h1 className="text-4xl font-cinzel font-bold text-amber-500 tracking-wide mb-4">
          ROSTRA
        </h1>

        {/* Loading Messages */}
        <div className="mb-2">
          <p className="text-zinc-100 text-lg font-medium">
            {getMessage()}
          </p>
        </div>

        <p className="text-zinc-400 text-sm max-w-md mx-auto">
          {getSubMessage()}
        </p>

        {/* Cold start specific styling */}
        {isColdStart && (
          <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg max-w-md mx-auto">
            <p className="text-amber-400 text-xs">
              <strong>Note:</strong> Free tier services can take 1-3 minutes to respond when waking up from sleep.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}