import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Users, AlertCircle } from 'lucide-react';
import { discoverRooms, joinRoom, leaveRoom } from '../services/api';
import type { Room } from '../types';

interface RoomDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRoomJoined: () => void; // Callback to refresh room list (used for both join and leave)
  currentUserId: number;
  joinedRoomIds: Set<number>; // Rooms user is already in
  token: string;
}

type TabType = 'browse' | 'your-rooms';

export function RoomDiscoveryModal({
  isOpen,
  onClose,
  onRoomJoined,
  currentUserId,
  joinedRoomIds,
  token,
}: RoomDiscoveryModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('browse');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningRoomId, setJoiningRoomId] = useState<number | null>(null);
  const [leavingRoomId, setLeavingRoomId] = useState<number | null>(null);
  /** Local optimistic state: do not mutate props */
  const [optimisticJoinedIds, setOptimisticJoinedIds] = useState<Set<number>>(() => new Set());
  const [optimisticLeftIds, setOptimisticLeftIds] = useState<Set<number>>(() => new Set());
  const modalRef = useRef<HTMLDivElement>(null);

  // Effective joined set: prop + optimistic join - optimistic leave
  const effectiveJoinedIds = useMemo(() => {
    const set = new Set(joinedRoomIds);
    optimisticJoinedIds.forEach((id) => set.add(id));
    optimisticLeftIds.forEach((id) => set.delete(id));
    return set;
  }, [joinedRoomIds, optimisticJoinedIds, optimisticLeftIds]);


  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  // Focus trap - keep focus inside modal
  useEffect(() => {
    if (!isOpen) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    firstElement.focus();

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    modal.addEventListener('keydown', handleTab);
    return () => modal.removeEventListener('keydown', handleTab);
  }, [isOpen]);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await discoverRooms(token);
      const sorted = [...data].sort((a, b) => {
        const aOwn = a.created_by === currentUserId ? 1 : 0;
        const bOwn = b.created_by === currentUserId ? 1 : 0;
        return aOwn - bOwn;
      });
      setRooms(sorted);
    } catch (err) {
      setError('Failed to load rooms');
      console.error('Error loading rooms:', err);
    } finally {
      setLoading(false);
    }
  }, [token, currentUserId]);

  useEffect(() => {
    if (isOpen) {
      loadRooms();
    }
  }, [isOpen, loadRooms]);

  const handleJoinRoom = async (roomId: number) => {
    setJoiningRoomId(roomId);
    setError(null);

    setOptimisticJoinedIds((prev) => new Set(prev).add(roomId));

    try {
      await joinRoom(roomId, token);
      onRoomJoined();
    } catch (err: unknown) {
      setOptimisticJoinedIds((prev) => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });

      const message = err instanceof Error ? err.message : '';
      if (message.includes('409') || message.includes('Already a member')) {
        setError('Already a member of this room');
      } else {
        setError('Failed to join room');
      }
      console.error('Error joining room:', err);
    } finally {
      setJoiningRoomId(null);
    }
  };

  const handleLeaveRoom = async (roomId: number) => {
    setLeavingRoomId(roomId);
    setError(null);

    setOptimisticLeftIds((prev) => new Set(prev).add(roomId));

    try {
      await leaveRoom(roomId, token);
      onRoomJoined();
    } catch (err: unknown) {
      setOptimisticLeftIds((prev) => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });

      const message = err instanceof Error ? err.message : '';
      if (message.includes('403') || message.includes('creator')) {
        setError('Room creators cannot leave their own rooms. Delete the room instead.');
      } else if (message.includes('400') || message.includes('Not a member')) {
        setError('You are not a member of this room');
      } else {
        setError('Failed to leave room');
      }
      console.error('Error leaving room:', err);
    } finally {
      setLeavingRoomId(null);
    }
  };

  const displayedRooms =
    activeTab === 'browse'
      ? rooms
      : rooms.filter((r) => effectiveJoinedIds.has(r.id));

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rooms-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-zinc-900 rounded-lg w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-zinc-800">
          <h2
            id="rooms-modal-title"
            className="text-xl font-cinzel font-semibold text-amber-500 leading-tight mb-4"
          >
            Room Management
          </h2>

          <div className="flex gap-2 border-b border-zinc-700">
            <button
              onClick={() => setActiveTab('browse')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === 'browse'
                  ? 'text-amber-500'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Browse
              {activeTab === 'browse' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('your-rooms')}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === 'your-rooms'
                  ? 'text-amber-500'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Your Rooms ({effectiveJoinedIds.size})
              {activeTab === 'your-rooms' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {loading && (
            <div className="text-center text-zinc-400 py-10 text-base">
              Loading rooms...
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-900 text-red-400 px-4 py-3 rounded-lg mb-5 text-sm leading-relaxed flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && displayedRooms.length === 0 && (
            <div className="text-center text-zinc-400 py-10 text-base">
              {activeTab === 'browse'
                ? 'No public rooms available'
                : "You haven't joined any rooms yet. Switch to the Browse tab to discover rooms!"}
            </div>
          )}

          {!loading && displayedRooms.length > 0 && (
            <ul className="space-y-2" role="list">
              {displayedRooms.map((room) => {
                const isJoined = effectiveJoinedIds.has(room.id);
                const isCreator = room.created_by === currentUserId;

                return (
                  <li
                    key={room.id}
                    className="flex items-center justify-between gap-3 py-3 px-4 bg-zinc-800/50 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <Users className="w-4 h-4 shrink-0 text-zinc-500" aria-hidden />
                      <span className="text-zinc-100 font-medium text-sm truncate" title={room.name}>
                        {room.name}
                      </span>
                      {isCreator && (
                        <span className="text-amber-500 text-xs shrink-0">· Yours</span>
                      )}
                    </div>

                    <div className="shrink-0">
                      {activeTab === 'browse' ? (
                        isJoined ? (
                          <span className="text-amber-500 font-medium text-sm whitespace-nowrap">
                            Joined ✓
                          </span>
                        ) : (
                          <button
                            onClick={() => handleJoinRoom(room.id)}
                            disabled={joiningRoomId === room.id}
                            className="px-3 py-1.5 bg-amber-500 text-zinc-900 font-medium rounded text-sm hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {joiningRoomId === room.id ? 'Joining...' : 'Join'}
                          </button>
                        )
                      ) : (
                        isCreator ? (
                          <span
                            className="text-zinc-500 text-sm whitespace-nowrap"
                            title="Room creators cannot leave their own rooms"
                          >
                            Creator
                          </span>
                        ) : (
                          <button
                            onClick={() => handleLeaveRoom(room.id)}
                            disabled={leavingRoomId === room.id}
                            className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/50 font-medium rounded text-sm hover:bg-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          >
                            {leavingRoomId === room.id ? 'Leaving...' : 'Leave'}
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
