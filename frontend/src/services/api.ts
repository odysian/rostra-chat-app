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

// Retry configuration for cold starts
const RETRY_CONFIG = {
  maxRetries: 4,
  baseDelay: 1000,  // 1s
  maxDelay: 8000,   // 8s
  timeout: 10000    // 10s request timeout
};

// Determine if an error should trigger a retry
function shouldRetry(error: Error, attempt: number): boolean {
  if (attempt >= RETRY_CONFIG.maxRetries) return false;

  // Don't retry on 401 auth errors - these should trigger logout
  if (error.message.includes('401') || error.message.includes('Unauthorized')) return false;

  // Retry on network errors, timeouts, and 5xx server errors
  return (
    error.message.includes('Failed to fetch') ||
    error.message.includes('NetworkError') ||
    error.message.includes('timeout') ||
    error.message.includes('502') ||
    error.message.includes('503') ||
    error.message.includes('504') ||
    error.message.includes('server error')
  );
}

// Calculate exponential backoff delay
function getDelay(attempt: number): number {
  const delay = Math.min(RETRY_CONFIG.baseDelay * Math.pow(2, attempt), RETRY_CONFIG.maxDelay);
  // Add jitter to prevent thundering herd
  return delay + Math.random() * 1000;
}

// Create request with timeout
function createRequestWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RETRY_CONFIG.timeout);

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).finally(() => {
    clearTimeout(timeoutId);
  });
}

// Helper for API calls with retry logic
async function apiCall<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const requestOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  };

  let lastError: Error = new Error("Unknown error");

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const response = await createRequestWithTimeout(url, requestOptions);

      if (!response.ok) {
        // Handle 401 immediately - no retry
        if (response.status === 401 && onUnauthorized) {
          onUnauthorized();
        }

        // Get error details
        let errorMessage = "API request failed";
        try {
          const errorData = await response.json();
          errorMessage = errorData.detail || errorMessage;
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        }

        const error = new Error(errorMessage);

        // Check if we should retry
        if (!shouldRetry(error, attempt)) {
          throw error;
        }

        lastError = error;

        // Wait before retry
        if (attempt < RETRY_CONFIG.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, getDelay(attempt)));
        }
      } else {
        // Success - return response data
        if (response.status === 204) {
          return {} as T;
        }
        return response.json();
      }
    } catch (error: unknown) {
      // Handle aborted requests
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${RETRY_CONFIG.timeout}ms`);
        if (!shouldRetry(timeoutError, attempt)) {
          throw timeoutError;
        }
        lastError = timeoutError;

        // Wait before retry
        if (attempt < RETRY_CONFIG.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, getDelay(attempt)));
        }
      } else if (error instanceof Error) {
        // Other errors
        if (!shouldRetry(error, attempt)) {
          throw error;
        }
        lastError = error;

        // Wait before retry
        if (attempt < RETRY_CONFIG.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, getDelay(attempt)));
        }
      } else {
        // Unknown error type
        const unknownError = new Error(String(error));
        if (!shouldRetry(unknownError, attempt)) {
          throw unknownError;
        }
        lastError = unknownError;

        // Wait before retry
        if (attempt < RETRY_CONFIG.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, getDelay(attempt)));
        }
      }
    }
  }

  // All retries exhausted
  throw lastError || new Error("Request failed after maximum retries");
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
export async function getRooms(
  token: string,
  options?: { includeUnread?: boolean }
): Promise<Room[]> {
  const includeUnread = options?.includeUnread ?? false;
  const query = includeUnread ? "?include_unread=true" : "";
  return apiCall<Room[]>(`/rooms${query}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function markRoomRead(roomId: number, token: string): Promise<void> {
  return apiCall<void>(`/rooms/${roomId}/read`, {
    method: "PATCH",
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

// Get all available rooms for discovery (public rooms)
export async function discoverRooms(token: string): Promise<Room[]> {
  return apiCall<Room[]>("/rooms/discover", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

// Join a room
export async function joinRoom(
  roomId: number,
  token: string
): Promise<{ message: string; room_id: number }> {
  return apiCall<{ message: string; room_id: number }>(
    `/rooms/${roomId}/join`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
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
