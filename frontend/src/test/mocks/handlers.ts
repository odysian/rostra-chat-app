import { http, HttpResponse } from "msw";
import type { Message, Room, User } from "../../types";

const defaultUser: User = {
  id: 1,
  username: "alice",
  email: "alice@example.com",
  created_at: "2024-01-01T00:00:00",
};

const defaultRooms: Room[] = [
  {
    id: 1,
    name: "General Discussion",
    created_by: 1,
    created_at: "2024-01-01T00:00:00",
    unread_count: 0,
  },
];

const defaultMessages: Message[] = [
  {
    id: 1,
    room_id: 1,
    user_id: 1,
    username: "alice",
    content: "Hello world",
    created_at: "2024-01-01T00:00:00",
  },
];

export const handlers = [
  http.post("*/api/auth/login", async () => {
    return HttpResponse.json({
      access_token: "test-token",
      token_type: "bearer",
    });
  }),

  http.post("*/api/auth/register", async () => {
    return HttpResponse.json({
      access_token: "test-token",
      token_type: "bearer",
    });
  }),

  http.get("*/api/auth/me", async () => {
    return HttpResponse.json(defaultUser);
  }),

  http.get("*/api/rooms", async () => {
    return HttpResponse.json(defaultRooms);
  }),

  http.post("*/api/rooms", async () => {
    return HttpResponse.json({
      id: 2,
      name: "New Room",
      created_by: 1,
      created_at: "2024-01-02T00:00:00",
      unread_count: 0,
    });
  }),

  http.get("*/api/rooms/discover", async () => {
    return HttpResponse.json(defaultRooms);
  }),

  http.post("*/api/rooms/:roomId/join", async () => {
    return HttpResponse.json({ message: "joined", room_id: 1 });
  }),

  http.post("*/api/rooms/:roomId/leave", async () => {
    return HttpResponse.json({ message: "left", room_id: 1 });
  }),

  http.delete("*/api/rooms/:roomId", async () => {
    return new HttpResponse(null, { status: 204 });
  }),

  http.get("*/api/rooms/:roomId/messages", async () => {
    return HttpResponse.json({
      messages: defaultMessages,
      next_cursor: null,
    });
  }),

  http.get("*/api/rooms/:roomId/messages/search", async () => {
    return HttpResponse.json({
      messages: defaultMessages,
      next_cursor: null,
    });
  }),
];
