import type { LoginRequest, RegisterRequest, AuthResponse, User, Room, Message } from "../types";

const API_BASE_URL = 'http://localhost:8000/api'

// Helper for API calls
async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'API request failed')
  }

  return response.json()
}

// Auth API calls
export async function login(credentials: LoginRequest): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export async function register(userData: RegisterRequest): Promise<User> {
  return apiCall<User>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  })
}

export async function getCurrentUser(token: string): Promise<User> {
  return apiCall<User>('/auth/me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// Room API calls
export async function getRooms(token: string): Promise<Room[]> {
  return apiCall<Room[]>('/rooms', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}

// Message API calls
export async function getRoomMessages(roomId: number, token: string): Promise<Message[]> {
  return apiCall<Message[]>(`/rooms/${roomId}/messages`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
}