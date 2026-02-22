import { getUserColorPalette } from "../../utils/userColors";
import type { Message } from "../../types";

interface MessageRowProps {
  message: Message;
  isGrouped: boolean;
  isComfortableDensity: boolean;
  theme: "neon" | "amber";
  isHighlighted: boolean;
  headerTime: string;
  hoverTime: string;
  fullDateTime: string;
}

export function MessageRow({
  message,
  isGrouped,
  isComfortableDensity,
  theme,
  isHighlighted,
  headerTime,
  hoverTime,
  fullDateTime,
}: MessageRowProps) {
  // Keep amber visuals cohesive by using per-user hues only in neon mode.
  const userColors = theme === "neon" ? getUserColorPalette(message.username) : null;

  return (
    <div
      data-chat-message="true"
      data-message-id={message.id}
      className={`group flex items-start hover:bg-white/[0.02] transition-colors ${
        isComfortableDensity ? "gap-3 px-2" : "gap-2.5 px-1.5"
      } ${
        isGrouped
          ? isComfortableDensity
            ? "mt-0.5 py-0.5"
            : "mt-0 py-0.5"
          : isComfortableDensity
            ? "mt-3.5 py-0.5"
            : "mt-2.5 py-0.5"
      }`}
      style={{
        animation: "slide-in 0.2s ease-out",
        background: isHighlighted ? "rgba(0, 240, 255, 0.10)" : undefined,
        borderLeft: isHighlighted
          ? "2px solid var(--color-primary)"
          : "2px solid transparent",
      }}
    >
      <div
        className={`shrink-0 select-none flex justify-center ${
          isComfortableDensity ? "w-11" : "w-9"
        }`}
      >
        {!isGrouped ? (
          <div
            className={`rounded-full flex items-center justify-center font-bebas ${
              isComfortableDensity ? "w-11 h-11 text-[16px]" : "w-9 h-9 text-[14px]"
            }`}
            style={{
              background: userColors?.backgroundColor ?? "var(--bg-app)",
              border: `1px solid ${userColors?.borderColor ?? "var(--border-primary)"}`,
              color: userColors?.textColor ?? "var(--color-primary)",
              boxShadow: userColors?.glowColor ?? "none",
            }}
          >
            {message.username.substring(0, 2).toUpperCase()}
          </div>
        ) : (
          <span
            className={`block font-mono pt-1 text-center w-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${
              isComfortableDensity ? "text-[12px]" : "text-[11px]"
            }`}
            style={{ color: "var(--color-meta)" }}
            title={fullDateTime}
          >
            {hoverTime}
          </span>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1">
        {!isGrouped && (
          <div className="flex items-baseline gap-2">
            <span
              className="font-mono font-semibold text-[14px] tracking-[0.06em]"
              style={{ color: userColors?.textColor ?? "var(--color-primary)" }}
            >
              {message.username}
            </span>
            <span
              className={`font-mono tracking-[0.08em] ${
                isComfortableDensity ? "text-[12px]" : "text-[11px]"
              }`}
              style={{ color: "var(--color-meta)" }}
              title={fullDateTime}
            >
              {headerTime}
            </span>
          </div>
        )}

        <div
          className={`font-mono break-words ${
            isComfortableDensity
              ? "text-[18px] leading-relaxed"
              : "text-[15px] leading-normal"
          } ${isGrouped ? "" : isComfortableDensity ? "mt-1" : "mt-0.5"}`}
          style={{ color: "var(--color-msg-text)" }}
        >
          {message.content}
        </div>
      </div>
    </div>
  );
}
