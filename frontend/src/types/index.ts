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
export type ReactionEmoji = "👍" | "👎" | "❤️" | "😂" | "🔥" | "👀" | "🎉";

export interface MessageReactionSummary {
  emoji: ReactionEmoji;
  count: number;
  reacted_by_me: boolean;
}

export interface Message {
  id: number;
  room_id: number;
  user_id: number;
  username: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  reactions?: MessageReactionSummary[];
}

export interface PaginatedMessages {
  messages: Message[];
  next_cursor: string | null;
}

export interface MessageContextResponse {
  messages: Message[];
  target_message_id: number;
  older_cursor: string | null;
  newer_cursor: string | null;
}

export interface MessageReactionUpdateResponse {
  message_id: number;
  room_id: number;
  reactions: MessageReactionSummary[];
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

export interface WSDeletedMessagePayload {
  id: number;
  room_id: number;
  deleted_at: string;
}

export interface WSMessageDeleted {
  type: "message_deleted";
  message: WSDeletedMessagePayload;
}

export interface WSEditedMessagePayload {
  id: number;
  room_id: number;
  content: string;
  edited_at: string;
}

export interface WSMessageEdited {
  type: "message_edited";
  message: WSEditedMessagePayload;
}

export interface WSReactionPayload {
  room_id: number;
  message_id: number;
  emoji: ReactionEmoji;
  user_id: number;
  count: number;
}

export interface WSMessageReactionAdded {
  type: "reaction_added";
  reaction: WSReactionPayload;
}

export interface WSMessageReactionRemoved {
  type: "reaction_removed";
  reaction: WSReactionPayload;
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
  | WSMessageEdited
  | WSMessageDeleted
  | WSMessageReactionAdded
  | WSMessageReactionRemoved
  | WSUserJoined
  | WSUserLeft
  | WSError
  | WSSubscribed
  | WSTypingIndicator;
