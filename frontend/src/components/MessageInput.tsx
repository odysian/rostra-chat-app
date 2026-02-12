import { useState } from "react";
import { Send } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useWebSocketContext } from "../context/useWebSocketContext";

interface MessageInputProps {
  roomId: number;
  onMessageSent?: () => void;
}

export default function MessageInput({ roomId, onMessageSent }: MessageInputProps) {
  const { token } = useAuth();
  const { sendMessage: wsSendMessage } = useWebSocketContext();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !token) return;

    setSending(true);

    try {
      wsSendMessage(roomId, content);
      setContent("");
      onMessageSent?.();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="shrink-0 h-14 sm:h-16 bg-zinc-900 border-t border-zinc-800 flex items-center px-2 sm:px-4 min-w-0"
    >
      <div className="flex gap-2 w-full min-w-0">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          className="min-w-0 flex-1 px-3 sm:px-4 py-2 bg-zinc-800 text-zinc-100 rounded border border-zinc-700 focus:outline-none focus:border-amber-500 disabled:opacity-50 text-sm sm:text-base"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="shrink-0 min-w-10 min-h-10 p-2 flex items-center justify-center bg-amber-500 text-zinc-900 rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title={sending ? "Sending..." : "Send"}
        >
          <Send className="w-5 h-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
