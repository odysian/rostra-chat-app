import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { getRooms } from "../services/api";
import type { Room } from "../types";

interface RoomListProps {
  selectedRoomId: number | null;
  onSelectRoom: (roomId: number) => void;
}

export default function RoomList({
  selectedRoomId,
  onSelectRoom,
}: RoomListProps) {
  const { token } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function fetchRooms() {
      if (!token) return;

      try {
        const fetchedRooms = await getRooms(token);
        setRooms(fetchedRooms);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load rooms");
      } finally {
        setLoading(false);
      }
    }
    fetchRooms();
  }, [token]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-zinc-400">Loading rooms...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 p-4">
        <div className="bg-red-900/20 text-red-400 p-3 rounded text-sm border border-red-900">
          {error}
        </div>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-zinc-400 text-sm">No rooms available</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {rooms.map((room) => (
        <button
          key={room.id}
          onClick={() => onSelectRoom(room.id)}
          className={`w-full text-left px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors ${
            selectedRoomId === room.id
              ? "bg-amber-500/10 border-l-4 border-l-amber-500"
              : ""
          }`}
        >
          <div
            className={`font-medium ${
              selectedRoomId === room.id ? "text-amber-500" : "text-zinc-100"
            }`}
          >
            {room.name}
          </div>
        </button>
      ))}
    </div>
  );
}
