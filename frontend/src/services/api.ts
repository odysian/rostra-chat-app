import type {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  Room,
  Message,
  PaginatedMessages,
  MessageContextResponse,
} from "../types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const API_URL = `${BASE_URL}/api`;

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

// Fire a lightweight request to wake sleeping backends before auth/data calls.
export async function warmUpBackend(signal?: AbortSignal): Promise<void> {
  await createRequestWithTimeout(`${BASE_URL}/`, {
    method: "GET",
    signal,
  });
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

// Create request with timeout; supports optional external AbortSignal (e.g. for effect cleanup).
// Timeout-caused aborts are converted to Error('Request timeout') so apiCall can retry them.
// Caller-initiated aborts (via external signal) stay as AbortError and are NOT retried.
function createRequestWithTimeout(url: string, options: RequestInit): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, RETRY_CONFIG.timeout);

  const externalSignal = options.signal;
  const onAbort = () => controller.abort();
  if (externalSignal) {
    externalSignal.addEventListener("abort", onAbort);
  }

  return fetch(url, {
    ...options,
    signal: controller.signal,
  }).catch((error) => {
    // Convert timeout aborts to a retryable error; let caller aborts propagate as AbortError
    if (error.name === 'AbortError' && timedOut) {
      throw new Error('Request timeout');
    }
    throw error;
  }).finally(() => {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onAbort);
    }
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
      // Aborted requests (timeout or caller cancellation) are not retried
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }
      if (error instanceof Error) {
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

export async function register(userData: RegisterRequest): Promise<AuthResponse> {
  return apiCall<AuthResponse>("/auth/register", {
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

export async function markRoomRead(
  roomId: number,
  token: string,
): Promise<{
  status: string;
  room_id: number;
  last_read_at: string | null;
}> {
  return apiCall<{
    status: string;
    room_id: number;
    last_read_at: string | null;
  }>(`/rooms/${roomId}/read`, {
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

// Leave a room
export async function leaveRoom(
  roomId: number,
  token: string
): Promise<{ message: string; room_id: number }> {
  return apiCall<{ message: string; room_id: number }>(
    `/rooms/${roomId}/leave`,
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
  signal?: AbortSignal,
  cursor?: string,
  limit?: number,
): Promise<PaginatedMessages> {
  // Build query string with cursor/limit if provided
  const params = new URLSearchParams();
  if (cursor) {
    params.set("cursor", cursor);
  }
  if (typeof limit === "number") {
    params.set("limit", String(limit));
  }
  const query = params.toString();
  const path = `/rooms/${roomId}/messages${query ? `?${query}` : ""}`;

  return apiCall<PaginatedMessages>(path, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getRoomMessagesNewer(
  roomId: number,
  token: string,
  cursor: string,
  signal?: AbortSignal,
): Promise<PaginatedMessages> {
  const params = new URLSearchParams({ cursor });
  return apiCall<PaginatedMessages>(`/rooms/${roomId}/messages/newer?${params}`, {
    signal,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export async function getMessageContext(
  roomId: number,
  messageId: number,
  token: string,
  signal?: AbortSignal,
  before = 25,
  after = 25,
): Promise<MessageContextResponse> {
  const params = new URLSearchParams({
    before: String(before),
    after: String(after),
  });

  return apiCall<MessageContextResponse>(
    `/rooms/${roomId}/messages/${messageId}/context?${params}`,
    {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
}

export async function searchMessages(
  roomId: number,
  query: string,
  token: string,
  signal?: AbortSignal,
  cursor?: string,
): Promise<PaginatedMessages> {
  const params = new URLSearchParams({ q: query });
  if (cursor) params.set("cursor", cursor);
  return apiCall<PaginatedMessages>(
    `/rooms/${roomId}/messages/search?${params}`,
    {
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );
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
