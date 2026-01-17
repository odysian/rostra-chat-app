import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../hooks/useWebSocket";

interface MessageInputProps {
  roomId: number;
}

export default function MessageInput({ roomId }: MessageInputProps) {
  const { token } = useAuth();
  const { sendMessage: wsSendMessage } = useWebSocket();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() || !token) return;

    setSending(true);

    try {
      wsSendMessage(roomId, content);
      setContent("");
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="h-16 bg-zinc-900 border-t border-zinc-800 flex items-center px-4"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
          className="flex-1 px-4 py-2 bg-zinc-800 text-zinc-100 rounded border border-zinc-700 focus:outline-none focus:border-amber-500 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={sending || !content.trim()}
          className="px-6 py-2 bg-amber-500 text-zinc-900 font-medium rounded hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </form>
  );
}
