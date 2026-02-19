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
      ? "radial-gradient(circle at 16% 18%, rgba(0, 240, 255, 0.14), transparent 46%), radial-gradient(circle at 82% 14%, rgba(255, 0, 204, 0.12), transparent 48%), radial-gradient(circle at 52% 90%, rgba(0, 240, 255, 0.06), transparent 42%)"
      : "radial-gradient(circle at 20% 16%, rgba(255, 191, 0, 0.14), transparent 48%), radial-gradient(circle at 82% 18%, rgba(255, 136, 0, 0.12), transparent 47%), radial-gradient(circle at 52% 90%, rgba(255, 191, 0, 0.08), transparent 44%)";

  const heroPanelShadow =
    theme === "neon"
      ? "0 0 0 1px var(--border-secondary), 0 0 28px rgba(0, 240, 255, 0.08)"
      : "0 0 0 1px var(--border-dim), 0 0 24px rgba(255, 191, 0, 0.1)";

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
        <div
          className="max-w-3xl px-7 py-8 md:px-10 md:py-10"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--border-primary)",
            boxShadow: heroPanelShadow,
          }}
        >
          <p
            className="font-pixel text-[7px] tracking-[0.25em] mb-4"
            style={{ color: "var(--color-meta)" }}
          >
            REAL·TIME·CHAT·APPLICATION
          </p>

          {theme === "neon" ? (
            <h1
              className="inline-block font-bebas text-[clamp(48px,14vw,80px)] leading-none tracking-[0.06em] gradient-text"
              style={{
                backgroundImage:
                  "linear-gradient(90deg, var(--color-primary), var(--color-secondary))",
              }}
            >
              ROSTRA
            </h1>
          ) : (
            <h1
              className="inline-block font-bebas text-[clamp(48px,14vw,80px)] leading-none tracking-[0.06em]"
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
            Lead the discussion. Join multiple rooms and chat live with everyone
            online.
          </p>

          <div className="flex flex-wrap gap-3 mt-8">
            <button
              onClick={() => navigate("/login")}
              className="px-6 py-3 font-bebas text-[16px] tracking-[0.12em] transition-all"
              style={{
                background:
                  "linear-gradient(135deg, var(--color-accent) 0%, var(--color-secondary) 100%)",
                color: "#000",
                border: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = "brightness(1.12)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = "brightness(1)";
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
                  theme === "neon"
                    ? "rgba(255, 0, 204, 0.07)"
                    : "rgba(255, 136, 0, 0.07)";
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
