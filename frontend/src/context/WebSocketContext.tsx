import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { WebSocketService } from "../services/websocket";
import { useAuth } from "./AuthContext";
import {
  WebSocketContext,
  type WebSocketContextType,
  type WebSocketMessage,
  type ConnectionStatus,
} from "./webSocketContextState";

export type { WebSocketMessage } from "./webSocketContextState";

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const wsRef = useRef<WebSocketService | null>(null);
  const currentTokenRef = useRef<string | null>(null);
  const messageHandlerRef = useRef<((msg: WebSocketMessage) => void) | undefined>(undefined);

  const registerMessageHandler = useCallback(
    (handler: ((msg: WebSocketMessage) => void) | undefined) => {
      messageHandlerRef.current = handler;
    },
    [],
  );

  useEffect(() => {
    if (!token) {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      currentTokenRef.current = null;
      const statusTimer = setTimeout(() => {
        setConnectionStatus("disconnected");
        setConnected(false);
      }, 0);
      return () => clearTimeout(statusTimer);
    }

    if (currentTokenRef.current === token && wsRef.current) {
      return;
    }

    if (wsRef.current) {
      wsRef.current.disconnect();
    }

    currentTokenRef.current = token;
    const ws = new WebSocketService(token);
    wsRef.current = ws;

    ws.onStatusChange((status) => {
      setConnectionStatus(status as ConnectionStatus);
      setConnected(status === "connected");
    });

    ws.onMessage((data) => {
      const msg = data as WebSocketMessage;
      setLastMessage(msg);
      messageHandlerRef.current?.(msg);
    });

    ws.connect();

    return () => {
      ws.disconnect();
    };
  }, [token]);

  const subscribe = useCallback((roomId: number) => {
    wsRef.current?.send({ action: "subscribe", room_id: roomId });
  }, []);

  const unsubscribe = useCallback((roomId: number) => {
    wsRef.current?.send({ action: "unsubscribe", room_id: roomId });
  }, []);

  const sendMessage = useCallback((roomId: number, content: string) => {
    wsRef.current?.send({ action: "send_message", room_id: roomId, content });
  }, []);

  const sendTypingIndicator = useCallback((roomId: number) => {
    wsRef.current?.send({ action: "user_typing", room_id: roomId });
  }, []);

  const value: WebSocketContextType = {
    connected,
    connectionStatus,
    lastMessage,
    subscribe,
    unsubscribe,
    sendMessage,
    sendTypingIndicator,
    registerMessageHandler,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}
