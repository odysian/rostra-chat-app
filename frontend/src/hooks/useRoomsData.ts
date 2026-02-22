import { useCallback, useEffect, useRef, useState } from "react";
import { createRoom, getRooms } from "../services/api";
import type { Room } from "../types";
import { logError } from "../utils/logger";

interface UseRoomsDataParams {
  token: string | null;
  refreshTrigger?: number;
  onUnreadCountsLoaded: (counts: Record<number, number>) => void;
  onInitialRoomsLoaded?: (rooms: Room[]) => void;
  onSelectRoom: (room: Room) => void;
}

interface UseRoomsDataResult {
  rooms: Room[];
  loading: boolean;
  error: string;
  creating: boolean;
  createError: string;
  newRoomName: string;
  setNewRoomName: (value: string) => void;
  retryLoadRooms: () => void;
  reloadRooms: () => Promise<void>;
  createRoomFromInput: () => Promise<boolean>;
  resetCreateState: () => void;
}

const ROOMS_LOAD_TIMEOUT_MS = 5000;

function buildUnreadCounts(rooms: Room[]): Record<number, number> {
  const counts: Record<number, number> = {};
  rooms.forEach((room) => {
    if (room.unread_count != null) {
      counts[room.id] = room.unread_count;
    }
  });
  return counts;
}

export function useRoomsData({
  token,
  refreshTrigger,
  onUnreadCountsLoaded,
  onInitialRoomsLoaded,
  onSelectRoom,
}: UseRoomsDataParams): UseRoomsDataResult {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [newRoomName, setNewRoomNameState] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Ref avoids stale state reads in async finally blocks.
  const timeoutFiredRef = useRef(false);
  const hasReportedInitialRoomsRef = useRef(false);
  const onUnreadCountsLoadedRef = useRef(onUnreadCountsLoaded);
  const onInitialRoomsLoadedRef = useRef(onInitialRoomsLoaded);

  useEffect(() => {
    onUnreadCountsLoadedRef.current = onUnreadCountsLoaded;
  }, [onUnreadCountsLoaded]);

  useEffect(() => {
    onInitialRoomsLoadedRef.current = onInitialRoomsLoaded;
  }, [onInitialRoomsLoaded]);

  useEffect(() => {
    let timeoutId: number;

    async function fetchRooms() {
      if (!token) return;

      timeoutFiredRef.current = false;
      setLoading(true);
      setError("");

      timeoutId = window.setTimeout(() => {
        timeoutFiredRef.current = true;
        setError(
          "Loading is taking longer than expected. The server may be waking up.",
        );
        setLoading(false);
      }, ROOMS_LOAD_TIMEOUT_MS);

      try {
        const fetchedRooms = await getRooms(token, { includeUnread: true });
        clearTimeout(timeoutId);
        setRooms(fetchedRooms);
        onUnreadCountsLoadedRef.current(buildUnreadCounts(fetchedRooms));

        if (
          !hasReportedInitialRoomsRef.current &&
          onInitialRoomsLoadedRef.current
        ) {
          hasReportedInitialRoomsRef.current = true;
          onInitialRoomsLoadedRef.current(fetchedRooms);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        setError(err instanceof Error ? err.message : "Failed to load rooms");
      } finally {
        if (!timeoutFiredRef.current) {
          setLoading(false);
        }
      }
    }

    fetchRooms();

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [token, refreshTrigger, retryCount]);

  const setNewRoomName = useCallback((value: string) => {
    setNewRoomNameState(value);
    if (createError) {
      setCreateError("");
    }
  }, [createError]);

  const retryLoadRooms = useCallback(() => {
    setLoading(true);
    setError("");
    // Bump local retry counter so room fetch effect reruns.
    setRetryCount((prev) => prev + 1);
  }, []);

  const reloadRooms = useCallback(async () => {
    if (!token) return;

    try {
      const fetchedRooms = await getRooms(token, { includeUnread: true });
      setRooms(fetchedRooms);
      onUnreadCountsLoadedRef.current(buildUnreadCounts(fetchedRooms));
    } catch (err) {
      logError("Error loading rooms:", err);
    }
  }, [token]);

  const createRoomFromInput = useCallback(async () => {
    if (!token) return false;

    const trimmedName = newRoomName.trim();
    if (trimmedName.length < 3) {
      setCreateError("Room name must be at least 3 characters");
      return false;
    }

    if (trimmedName.length > 50) {
      setCreateError("Room name must be less than 50 characters");
      return false;
    }

    setCreating(true);
    setCreateError("");

    try {
      const createdRoom = await createRoom(trimmedName, token);
      setRooms((prevRooms) => [...prevRooms, createdRoom]);
      onSelectRoom(createdRoom);
      setNewRoomNameState("");
      return true;
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create room",
      );
      return false;
    } finally {
      setCreating(false);
    }
  }, [newRoomName, onSelectRoom, token]);

  const resetCreateState = useCallback(() => {
    setNewRoomNameState("");
    setCreateError("");
  }, []);

  return {
    rooms,
    loading,
    error,
    creating,
    createError,
    newRoomName,
    setNewRoomName,
    retryLoadRooms,
    reloadRooms,
    createRoomFromInput,
    resetCreateState,
  };
}
