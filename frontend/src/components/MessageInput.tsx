import { useState, useRef, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocketContext } from "../context/useWebSocketContext";
import { logError } from "../utils/logger";
import { formatRoomNameForDisplay } from "../utils/roomNames";

interface MessageInputProps {
  roomId: number;
  roomName: string;
  onMessageSent?: () => void;
}

export default function MessageInput({
  roomId,
  roomName,
  onMessageSent,
}: MessageInputProps) {
  const displayRoomName = formatRoomNameForDisplay(roomName);
  const { token } = useAuth();
  const { connected, sendMessage: wsSendMessage, sendTypingIndicator } = useWebSocketContext();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const typingCooldownRef = useRef(false);
  const typingCooldownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Clear pending cooldown timeout on unmount to avoid stale timer callbacks.
  useEffect(() => {
    return () => {
      if (typingCooldownTimeoutRef.current) {
        clearTimeout(typingCooldownTimeoutRef.current);
      }
    };
  }, []);

  const syncTextareaHeight = (element: HTMLTextAreaElement) => {
    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, 120)}px`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
    if (sendError) {
      setSendError(null);
    }
    syncTextareaHeight(e.target);

    // Throttle: send at most one typing event per 2s
    if (e.target.value.length > 0 && !typingCooldownRef.current) {
      sendTypingIndicator(roomId);
      typingCooldownRef.current = true;

      if (typingCooldownTimeoutRef.current) {
        clearTimeout(typingCooldownTimeoutRef.current);
      }

      typingCooldownTimeoutRef.current = setTimeout(() => {
        typingCooldownRef.current = false;
        typingCooldownTimeoutRef.current = null;
      }, 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !token) return;
    if (!connected) {
      setSendError("Not connected. Wait for reconnection and try again.");
      return;
    }

    setSending(true);
    setSendError(null);
    // Reset cooldown so next typing session starts fresh
    typingCooldownRef.current = false;

    try {
      wsSendMessage(roomId, content);
      setContent("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      onMessageSent?.();
    } catch (err) {
      logError("Failed to send message", err);
      setSendError("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 min-w-0"
      style={{
        borderTop: "1px solid var(--border-primary)",
        background: "var(--bg-input)",
        padding: "12px 16px",
      }}
    >
      <div
        className="flex w-full min-w-0"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          border: isFocused
            ? "1px solid var(--color-primary)"
            : isHovered
              ? "1px solid var(--border-primary)"
              : "1px solid var(--border-dim)",
          borderRadius: "3px",
          boxShadow: isFocused || isHovered ? "var(--glow-primary)" : "none",
        }}
      >
        <textarea
          ref={textareaRef}
          data-tab-focus="message-input"
          value={content}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={`Message #${displayRoomName}`}
          disabled={sending}
          rows={1}
          className="min-w-0 flex-1 px-3 py-2 bg-transparent focus:outline-none disabled:opacity-50 font-mono text-[14px] placeholder:text-[var(--color-meta)] resize-none max-h-[120px]"
          style={{
            color: "var(--color-primary)",
            caretColor: "var(--color-primary)",
          }}
        />
        <button
          type="submit"
          data-tab-focus="send-button"
          disabled={sending || !content.trim()}
          className="shrink-0 px-5 py-2 font-bebas text-[16px] tracking-[0.15em] border-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: "linear-gradient(135deg, var(--color-accent) 0%, var(--color-secondary) 100%)",
            color: "#000",
          }}
          title={sending ? "Sending..." : "Send"}
          onMouseEnter={(e) => {
            if (!sending && content.trim()) {
              e.currentTarget.style.filter = "brightness(1.15)";
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = "brightness(1)";
          }}
        >
          SEND
        </button>
      </div>
      {sendError && (
        <p
          role="alert"
          className="mt-2 font-mono text-[12px]"
          style={{ color: "#ff4444" }}
        >
          {sendError}
        </p>
      )}
    </form>
  );
}
