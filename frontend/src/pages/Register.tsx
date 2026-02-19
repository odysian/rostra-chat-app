import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Info, Loader2 } from "lucide-react";
import { register } from "../services/api";
import { useTheme } from "../context/ThemeContext";

export default function Register() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const atmosphere =
    theme === "neon"
      ? "radial-gradient(circle at 16% 18%, rgba(0, 240, 255, 0.14), transparent 46%), radial-gradient(circle at 82% 14%, rgba(255, 0, 204, 0.12), transparent 48%), radial-gradient(circle at 52% 90%, rgba(0, 240, 255, 0.06), transparent 42%)"
      : "radial-gradient(circle at 20% 16%, rgba(255, 191, 0, 0.14), transparent 48%), radial-gradient(circle at 82% 18%, rgba(255, 136, 0, 0.12), transparent 47%), radial-gradient(circle at 52% 90%, rgba(255, 191, 0, 0.08), transparent 44%)";
  const panelShadow =
    theme === "neon"
      ? "0 0 0 1px var(--border-secondary), 0 0 24px rgba(0, 240, 255, 0.08)"
      : "0 0 0 1px var(--border-dim), 0 0 20px rgba(255, 191, 0, 0.1)";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register({ username, email, password });
      // Redirect to login with success flag so login page can show confirmation (no token from register)
      navigate("/login?registered=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center p-4"
      style={{ background: "var(--bg-app)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: atmosphere }}
      />

      <div className="relative w-full max-w-[400px]">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          {theme === "neon" ? (
            <h1
              className="inline-block font-bebas text-[56px] tracking-[0.06em] mb-2 gradient-text"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
              }}
            >
              ROSTRA
            </h1>
          ) : (
            <h1
              className="inline-block font-bebas text-[46px] tracking-[0.06em] mb-2"
              style={{
                color: "var(--color-primary)",
                textShadow: "var(--glow-primary)",
              }}
            >
              ROSTRA
            </h1>
          )}
          <p
            className="font-pixel text-[8px] tracking-[0.25em]"
            style={{ color: "var(--color-meta)" }}
          >
            LEAD·THE·DISCUSSION
          </p>
        </div>

        {/* Form Card */}
        <div
          className="p-8"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border-primary)",
            boxShadow: panelShadow,
          }}
        >
          <h2
            className="font-bebas text-[24px] tracking-[0.08em] mb-6"
            style={{ color: "var(--color-text)" }}
          >
            Create an account
          </h2>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <div
                className="p-3 font-mono text-[12px]"
                style={{
                  background: "rgba(255, 0, 0, 0.05)",
                  border: "1px solid rgba(255, 0, 0, 0.2)",
                  color: "#ff4444",
                }}
              >
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="username"
                  className="block font-pixel text-[7px] tracking-[0.2em] mb-2"
                  style={{ color: "var(--color-meta)" }}
                >
                  USERNAME
                </label>
                <input
                  id="username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-3 font-mono text-[14px] focus:outline-none transition-all"
                  style={{
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--color-primary)",
                    borderRadius: "2px",
                  }}
                  placeholder="Choose a username"
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "var(--glow-primary)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="block font-pixel text-[7px] tracking-[0.2em] mb-2"
                  style={{ color: "var(--color-meta)" }}
                >
                  EMAIL
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-3 font-mono text-[14px] focus:outline-none transition-all"
                  style={{
                    background: "var(--bg-app)",
                    border: "1px solid var(--border-primary)",
                    color: "var(--color-primary)",
                    borderRadius: "2px",
                  }}
                  placeholder="you@example.com"
                  onFocus={(e) => {
                    e.currentTarget.style.boxShadow = "var(--glow-primary)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block font-pixel text-[7px] tracking-[0.2em] mb-2"
                  style={{ color: "var(--color-meta)" }}
                >
                  PASSWORD
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-3 pr-12 font-mono text-[14px] focus:outline-none transition-all"
                    style={{
                      background: "var(--bg-app)",
                      border: "1px solid var(--border-primary)",
                      color: "var(--color-primary)",
                      borderRadius: "2px",
                    }}
                    placeholder="Choose a password"
                    onFocus={(e) => {
                      e.currentTarget.style.boxShadow = "var(--glow-primary)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: "var(--color-meta)" }}
                  >
                    {showPassword ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Cold start disclaimer */}
            <div
              className="flex items-start gap-2 p-3"
              style={{
                border: "1px solid var(--border-dim)",
              }}
            >
              <Info
                size={16}
                style={{ color: "var(--color-primary)" }}
                className="mt-0.5 shrink-0"
              />
              <p
                className="font-mono text-[11px] leading-relaxed"
                style={{ color: "var(--color-meta)" }}
              >
                Initial requests may take up to a minute while servers start up.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 font-bebas text-[16px] tracking-[0.15em] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-accent) 0%, var(--color-secondary) 100%)",
                color: "#000",
                border: "none",
              }}
              onMouseEnter={(e) => {
                if (!loading) e.currentTarget.style.filter = "brightness(1.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  REGISTERING...
                </>
              ) : (
                "CREATE ACCOUNT"
              )}
            </button>

            <div className="text-center">
              <a
                href="/login"
                className="font-mono text-[12px] transition-colors hover:underline"
                style={{ color: "var(--color-primary)" }}
              >
                Already have an account? Sign in
              </a>
            </div>
          </form>
        </div>

        {/* Footer text */}
        <p
          className="text-center font-pixel text-[7px] tracking-[0.15em] mt-8"
          style={{ color: "var(--color-meta)" }}
        >
          REAL·TIME·CHAT·APPLICATION
        </p>
      </div>
    </div>
  );
}
