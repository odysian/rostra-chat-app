import { useEffect, useState, useRef } from "react";
import { WebSocketService } from "../services/websocket";
import { useAuth } from "../context/AuthContext";
import type { WSNewMessage, WSUserJoined, WSUserLeft, WSError } from "../types";

type WebSocketMessage = WSNewMessage | WSUserJoined | WSUserLeft | WSError;

export function useWebSocket() {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    if (!token) return;

    // Create service
    const ws = new WebSocketService(token);
    wsRef.current = ws;

    // Register callbacks
    ws.onStatusChange((status) => {
      setConnected(status === "connected");
    });

    ws.onMessage((data) => {
      setLastMessage(data);
    });

    // Connect
    ws.connect();

    // Cleanup on unmount
    return () => {
      ws.disconnect();
    };
  }, [token]);

  const subscribe = (roomId: number) => {
    wsRef.current?.send({ action: "subscribe", room_id: roomId });
  };

  const sendMessage = (roomId: number, content: string) => {
    wsRef.current?.send({ action: "send_message", room_id: roomId, content });
  };

  return { connected, lastMessage, subscribe, sendMessage };
}
