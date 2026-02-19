import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { warmUpBackend } from "../services/api";
import { useTheme } from "../context/ThemeContext";

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();

  useEffect(() => {
    const controller = new AbortController();

    // Best-effort ping to reduce cold-start delay before the user signs in.
    void warmUpBackend(controller.signal).catch(() => {});

    return () => {
      controller.abort();
    };
  }, []);

  const atmosphere =
    theme === "neon"
      ? "radial-gradient(circle at 15% 20%, rgba(0, 240, 255, 0.12), transparent 45%), radial-gradient(circle at 85% 10%, rgba(255, 0, 204, 0.1), transparent 45%), radial-gradient(circle at 50% 85%, rgba(57, 255, 20, 0.08), transparent 40%)"
      : "radial-gradient(circle at 20% 15%, rgba(255, 191, 0, 0.13), transparent 48%), radial-gradient(circle at 80% 20%, rgba(255, 136, 0, 0.12), transparent 45%), radial-gradient(circle at 50% 88%, rgba(255, 191, 0, 0.06), transparent 42%)";

  return (
    <div
      className="relative min-h-screen overflow-hidden flex flex-col"
      style={{ background: "var(--bg-app)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: atmosphere }}
      />

      <div className="relative flex-1 flex items-center px-6 py-16 md:px-12 lg:px-20">
        <div className="max-w-3xl">
          <p
            className="font-pixel text-[7px] tracking-[0.25em] mb-4"
            style={{ color: "var(--color-meta)" }}
          >
            REAL·TIME·CHAT·APPLICATION
          </p>

          {theme === "neon" ? (
            <h1
              className="font-bebas text-[clamp(48px,14vw,80px)] leading-none tracking-[0.08em] gradient-text"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
              }}
            >
              ROSTRA
            </h1>
          ) : (
            <h1
              className="font-bebas text-[clamp(48px,14vw,80px)] leading-none tracking-[0.08em]"
              style={{
                color: "var(--color-primary)",
                textShadow: "var(--glow-primary)",
              }}
            >
              ROSTRA
            </h1>
          )}

          <p
            className="font-mono text-[16px] leading-relaxed mt-4 max-w-2xl"
            style={{ color: "var(--color-text)" }}
          >
            Lead the discussion in real time. Join rooms instantly, track unread
            messages, and chat live with everyone online.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={() => navigate("/login")}
              className="px-6 py-3 font-bebas text-[16px] tracking-[0.12em] transition-all"
              style={{
                background: "transparent",
                border: "1px solid var(--color-primary)",
                color: "var(--color-primary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  theme === "neon" ? "rgba(0, 240, 255, 0.07)" : "rgba(255, 191, 0, 0.07)";
                e.currentTarget.style.boxShadow = "var(--glow-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              ENTER CHAT
            </button>
            <button
              onClick={() => navigate("/register")}
              className="px-6 py-3 font-bebas text-[16px] tracking-[0.12em] transition-all"
              style={{
                background: "transparent",
                border: "1px solid var(--color-secondary)",
                color: "var(--color-secondary)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  theme === "neon" ? "rgba(255, 0, 204, 0.07)" : "rgba(255, 136, 0, 0.07)";
                e.currentTarget.style.boxShadow = "var(--glow-secondary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              CREATE ACCOUNT
            </button>
          </div>

          <a
            href="https://github.com/odysian/rostra-chat-app"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex mt-6 font-mono text-[12px] underline underline-offset-4 transition-colors"
            style={{ color: "var(--color-primary)" }}
          >
            VIEW SOURCE ON GITHUB
          </a>
        </div>
      </div>

      <footer
        className="relative py-4 px-6 text-center"
        style={{ borderTop: "1px solid var(--border-dim)" }}
      >
        <p
          className="font-pixel text-[7px] tracking-[0.15em]"
          style={{ color: "var(--color-meta)" }}
        >
          © 2026 Rostra
        </p>
      </footer>
    </div>
  );
}
