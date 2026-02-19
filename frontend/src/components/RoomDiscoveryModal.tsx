import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertCircle } from 'lucide-react';
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
      // Clear "optimistically left" so effectiveJoinedIds shows joined (leave-then-join without closing modal)
      setOptimisticLeftIds((prev) => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
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
      // Clear "optimistically joined" so we don't double-count if they re-join later in same session
      setOptimisticJoinedIds((prev) => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 cursor-pointer"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rooms-modal-title"
    >
      <div
        ref={modalRef}
        className="w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl cursor-auto"
        style={{
          background: "var(--bg-panel)",
          border: "1px solid var(--border-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="px-6 py-5"
          style={{ borderBottom: "1px solid var(--border-dim)" }}
        >
          <h2
            id="rooms-modal-title"
            className="font-bebas text-[22px] tracking-[0.08em] leading-tight mb-4"
            style={{ color: "var(--color-primary)" }}
          >
            Room Management
          </h2>

          <div className="flex gap-2" style={{ borderBottom: "1px solid var(--border-dim)" }}>
            <button
              onClick={() => setActiveTab('browse')}
              className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors relative"
              style={{
                color: activeTab === 'browse' ? 'var(--color-primary)' : 'var(--color-meta)',
              }}
            >
              BROWSE
              {activeTab === 'browse' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: "var(--color-primary)" }}
                />
              )}
            </button>

            <button
              onClick={() => setActiveTab('your-rooms')}
              className="px-4 py-2 font-bebas text-[14px] tracking-[0.10em] transition-colors relative"
              style={{
                color: activeTab === 'your-rooms' ? 'var(--color-primary)' : 'var(--color-meta)',
              }}
            >
              YOUR ROOMS ({effectiveJoinedIds.size})
              {activeTab === 'your-rooms' && (
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5"
                  style={{ background: "var(--color-primary)" }}
                />
              )}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
          {loading && (
            <div className="text-center py-10">
              <span className="font-mono text-[14px]" style={{ color: "var(--color-meta)" }}>
                Loading rooms...
              </span>
            </div>
          )}

          {error && (
            <div
              className="px-4 py-3 mb-5 font-mono text-[12px] leading-relaxed flex items-start gap-2"
              style={{
                background: "rgba(255, 0, 0, 0.05)",
                border: "1px solid rgba(255, 0, 0, 0.2)",
                color: "#ff4444",
              }}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && displayedRooms.length === 0 && (
            <div className="text-center py-10">
              <span className="font-mono text-[14px]" style={{ color: "var(--color-meta)" }}>
                {activeTab === 'browse'
                  ? 'No public rooms available'
                  : "You haven't joined any rooms yet. Switch to the Browse tab to discover rooms!"}
              </span>
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
                    className="flex items-center justify-between gap-3 py-3 px-4 transition-colors"
                    style={{
                      background: "var(--bg-bubble)",
                      border: "1px solid var(--border-dim)",
                    }}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span
                        className="font-bebas text-[17px] tracking-[0.08em] truncate"
                        style={{ color: "var(--color-text)" }}
                        title={room.name}
                      >
                        {room.name}
                      </span>
                      {isCreator && (
                        <span
                          className="font-pixel text-[7px]"
                          style={{ color: "var(--color-primary)" }}
                        >
                          YOURS
                        </span>
                      )}
                    </div>

                    <div className="shrink-0">
                      {activeTab === 'browse' ? (
                        isJoined ? (
                          <span
                            className="font-bebas text-[14px] tracking-[0.10em] whitespace-nowrap"
                            style={{ color: "var(--color-primary)" }}
                          >
                            JOINED
                          </span>
                        ) : (
                          <button
                            onClick={() => handleJoinRoom(room.id)}
                            disabled={joiningRoomId === room.id}
                            className="px-3 py-1.5 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            style={{
                              background: "var(--color-primary)",
                              color: "#000",
                              border: "1px solid var(--color-primary)",
                            }}
                          >
                            {joiningRoomId === room.id ? 'JOINING...' : 'JOIN'}
                          </button>
                        )
                      ) : (
                        isCreator ? (
                          <span
                            className="font-mono text-[12px] whitespace-nowrap"
                            style={{ color: "var(--color-meta)" }}
                            title="Room creators cannot leave their own rooms"
                          >
                            Creator
                          </span>
                        ) : (
                          <button
                            onClick={() => handleLeaveRoom(room.id)}
                            disabled={leavingRoomId === room.id}
                            className="px-3 py-1.5 font-bebas text-[14px] tracking-[0.10em] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                            style={{
                              background: "transparent",
                              color: "#ff4444",
                              border: "1px solid rgba(255, 68, 68, 0.5)",
                            }}
                          >
                            {leavingRoomId === room.id ? 'LEAVING...' : 'LEAVE'}
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

        <div className="px-6 py-4" style={{ borderTop: "1px solid var(--border-dim)" }}>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 font-bebas text-[14px] tracking-[0.10em] transition-colors"
            style={{
              background: "transparent",
              border: "1px solid var(--border-dim)",
              color: "var(--color-text)",
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
