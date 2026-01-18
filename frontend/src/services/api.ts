import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  Room,
  Message,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const API_URL = `${BASE_URL}/api`;

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// Helper for API calls
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    const error = await response.json();
    throw new Error(error.detail || "API request failed");
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Auth API calls
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  return apiCall<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(credentials),
  });
}

export async function register(userData: RegisterRequest): Promise<User> {
  return apiCall<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(userData),
  });
}

export async function getCurrentUser(token: string): Promise<User> {
  return apiCall<User>("/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Room API calls
export async function getRooms(token: string): Promise<Room[]> {
  return apiCall<Room[]>("/rooms", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function createRoom(name: string, token: string): Promise<Room> {
  return apiCall<Room>("/rooms", {
    method: "POST",
    body: JSON.stringify({ name }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function deleteRoom(roomId: number, token: string): Promise<void> {
  return apiCall<void>(`/rooms/${roomId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Message API calls
export async function getRoomMessages(
  roomId: number,
  token: string,
): Promise<Message[]> {
  return apiCall<Message[]>(`/rooms/${roomId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function sendMessage(
  roomId: number,
  content: string,
  token: string,
): Promise<Message> {
  return apiCall<Message>("/messages", {
    method: "POST",
    body: JSON.stringify({
      room_id: roomId,
      content: content,
    }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
