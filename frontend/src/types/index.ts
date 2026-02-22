// User types
export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface OnlineUser {
  id: number;
  username: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

// Room types
export interface Room {
  id: number;
  name: string;
  created_by: number;
  created_at: string;
  /** Membership read marker used for unread boundary placement in message view. */
  last_read_at?: string | null;
  /** Present when fetched with include_unread=true */
  unread_count?: number;
}

// Message types
export interface Message {
  id: number;
  room_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
}

export interface PaginatedMessages {
  messages: Message[];
  next_cursor: string | null;
}

// WebSocket message types
export interface WSSubscribe {
  action: "subscribe";
  room_id: number;
}

export interface WSSendMessage {
  action: "send_message";
  room_id: number;
  content: string;
}

export interface WSUserTyping {
  action: "user_typing";
  room_id: number;
}

export interface WSNewMessage {
  type: "new_message";
  message: Message;
}

export interface WSUserJoined {
  type: "user_joined";
  room_id: number;
  user: {
    id: number;
    username: string;
  };
}

export interface WSUserLeft {
  type: "user_left";
  room_id: number;
  user: {
    id: number;
    username: string;
  };
}

export interface WSSubscribed {
  type: "subscribed";
  room_id: number;
  online_users: Array<{
    id: number;
    username: string;
  }>;
}

export interface WSError {
  type: "error";
  message: string;
}

export interface WSTypingIndicator {
  type: "typing_indicator";
  room_id: number;
  user: {
    id: number;
    username: string;
  };
}

export type WebSocketMessage =
  | WSNewMessage
  | WSUserJoined
  | WSUserLeft
  | WSError
  | WSSubscribed
  | WSTypingIndicator;
