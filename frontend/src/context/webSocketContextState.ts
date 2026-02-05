import { createContext, useContext } from "react";
import type {
  WSNewMessage,
  WSUserJoined,
  WSUserLeft,
  WSError,
  WSSubscribed,
} from "../types";

export type WebSocketMessage =
  | WSNewMessage
  | WSUserJoined
  | WSUserLeft
  | WSError
  | WSSubscribed;

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "reconnecting"
  | "connected"
  | "error";

export interface WebSocketContextType {
  connected: boolean;
  connectionStatus: ConnectionStatus;
  lastMessage: WebSocketMessage | null;
  subscribe: (roomId: number) => void;
  unsubscribe: (roomId: number) => void;
  sendMessage: (roomId: number, content: string) => void;
  /** Register a handler for every message (e.g. ChatLayout). Only one handler; call with undefined to clear. */
  registerMessageHandler: (handler: ((msg: WebSocketMessage) => void) | undefined) => void;
}

export const WebSocketContext = createContext<WebSocketContextType | null>(null);

export function useWebSocketContext(): WebSocketContextType {
  const ctx = useContext(WebSocketContext);
  if (ctx == null) {
    throw new Error("useWebSocketContext must be used within WebSocketProvider");
  }
  return ctx;
}
