import { useEffect, useState, useRef } from "react";
import { WebSocketService } from "../services/websocket";
import { useAuth } from "../context/AuthContext";
import type {
  WSNewMessage,
  WSUserJoined,
  WSUserLeft,
  WSError,
  WSSubscribed,
} from "../types";

type WebSocketMessage =
  | WSNewMessage
  | WSUserJoined
  | WSUserLeft
  | WSError
  | WSSubscribed;

export function useWebSocket() {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "reconnecting" | "connected" | "error">("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);
  const currentTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!token) {
      // Disconnect when no token
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      currentTokenRef.current = null;
      
      // Defer state setting to avoid cascading renders
      const statusTimer = setTimeout(() => {
        setConnectionStatus("disconnected");
        setConnected(false);
      }, 0);
      
      return () => clearTimeout(statusTimer);
    }

    // Only recreate service if token changed
    if (currentTokenRef.current === token && wsRef.current) {
      return;
    }

    // Cleanup existing connection
    if (wsRef.current) {
      wsRef.current.disconnect();
    }

    currentTokenRef.current = token;

    // Create new service
    const ws = new WebSocketService(token);
    wsRef.current = ws;

    // Register callbacks
    ws.onStatusChange((status) => {
      setConnectionStatus(status as "disconnected" | "connecting" | "reconnecting" | "connected" | "error");
      setConnected(status === "connected");
    });

    ws.onMessage((data) => {
      setLastMessage(data as WebSocketMessage);
    });

    // Connect
    ws.connect();

    // Cleanup on unmount or token change
    return () => {
      ws.disconnect();
    };
  }, [token]);

  const subscribe = (roomId: number) => {
    wsRef.current?.send({ action: "subscribe", room_id: roomId });
  };

  const unsubscribe = (roomId: number) => {
    if (wsRef.current) {
      wsRef.current.send({ action: "unsubscribe", room_id: roomId });
    }
  };

  const sendMessage = (roomId: number, content: string) => {
    wsRef.current?.send({ action: "send_message", room_id: roomId, content });
  };

  return { 
    connected, 
    connectionStatus, 
    lastMessage, 
    subscribe, 
    unsubscribe, 
    sendMessage 
  };
}
