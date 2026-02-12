import { useState } from "react";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import type { Message, Room } from "../types";
import { useAuth } from "../context/AuthContext";
import { deleteRoom } from "../services/api";

interface MessageAreaProps {
  selectedRoom: Room | null;
  incomingMessages: Message[];
  onIncomingMessagesProcessed: () => void;
  onToggleUsers: () => void;
  onRoomDeleted: () => void;
  onLeaveRoom: () => void;
  onBackToRooms: () => void;
  isMobile: boolean;
  typingUsernames: string[];
}

export default function MessageArea({
  selectedRoom,
  incomingMessages,
  onIncomingMessagesProcessed,
  onToggleUsers,
  onRoomDeleted,
  onLeaveRoom,
  onBackToRooms,
  typingUsernames,
}: MessageAreaProps) {
  const { user, token } = useAuth();
  const [showRoomMenu, setShowRoomMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Inline error message for failed room deletion (avoid disruptive alerts)
  const [deleteError, setDeleteError] = useState("");
  // Incrementing this counter lets MessageList react to local sends and jump to latest.
  const [scrollToLatestSignal, setScrollToLatestSignal] = useState(0);

  if (!selectedRoom) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-zinc-400 mb-2">
            Welcome to Rostra
          </h2>
          <p className="text-zinc-500">
            Select a room from the sidebar to start chatting
          </p>
        </div>
      </div>
    );
  }

  const isRoomOwner = user?.id === selectedRoom.created_by;

  // Format typing indicator text based on number of users
  const formatTypingText = (usernames: string[]): string => {
    if (usernames.length === 0) return "";
    if (usernames.length === 1) return `${usernames[0]} is typing...`;
    if (usernames.length === 2)
      return `${usernames[0]} and ${usernames[1]} are typing...`;
    if (usernames.length === 3)
      return `${usernames[0]}, ${usernames[1]}, and ${usernames[2]} are typing...`;
    return `${usernames[0]}, ${usernames[1]}, and ${usernames.length - 2} others are typing...`;
  };

  const handleDeleteRoom = async () => {
    if (!token) return;

    setDeleting(true);
    setDeleteError("");
    try {
      await deleteRoom(selectedRoom.id, token);
      setShowDeleteModal(false);
      setShowRoomMenu(false);
      onRoomDeleted();
    } catch (err) {
      console.error("Failed to delete room:", err);
      setDeleteError(
        err instanceof Error
          ? err.message
          : "Failed to delete room. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 min-h-0 min-w-0 overflow-hidden">
      {/* Room Header - room name truncates so long names don't break layout */}
      <div className="h-14 shrink-0 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between gap-2 px-3 sm:px-4 min-w-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Back button - mobile only */}
          <button
            onClick={onBackToRooms}
            className="shrink-0 text-zinc-400 hover:text-amber-500 transition-colors md:hidden"
            title="Back to rooms"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div className="min-w-0 flex-1 overflow-hidden">
            <h2
              className="text-lg font-semibold text-zinc-100 truncate"
              title={selectedRoom.name}
            >
              # {selectedRoom.name}
            </h2>
          </div>

          {/* Room Options Menu - Always show the button */}
          <div className="relative shrink-0">
            <button
              onClick={() => setShowRoomMenu(!showRoomMenu)}
              className="text-zinc-400 hover:text-amber-500 transition-colors p-1"
              title="Room options"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showRoomMenu && (
              <>
                {/* Backdrop to close menu */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowRoomMenu(false)}
                />
                {/* Menu */}
                <div className="absolute right-0 mt-2 w-48 bg-zinc-800 rounded-lg shadow-lg border border-zinc-700 py-1 z-20">
                  {/* Leave Room - always visible */}
                  <button
                    onClick={() => {
                      setShowRoomMenu(false);
                      onLeaveRoom();
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    Leave Room
                  </button>

                  {/* Delete Room - only for owner */}
                  {isRoomOwner && (
                    <>
                      <div className="border-t border-zinc-700 my-1" />
                      <button
                        onClick={() => {
                          setShowRoomMenu(false);
                          setDeleteError("");
                          setShowDeleteModal(true);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 transition-colors"
                      >
                        Delete Room
                      </button>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <button
          onClick={onToggleUsers}
          className="shrink-0 text-zinc-400 hover:text-amber-500 transition-colors"
          title="Toggle users panel"
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
            />
          </svg>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-800 rounded-lg p-6 max-w-md w-full mx-4 border border-zinc-700">
            <h3 className="text-xl font-semibold text-zinc-100 mb-2">
              Delete Room?
            </h3>
            <p className="text-zinc-400 mb-6">
              Are you sure you want to delete{" "}
              <span className="text-amber-500 font-medium">
                #{selectedRoom.name}
              </span>
              ? This will permanently delete all messages in this room. This
              action cannot be undone.
            </p>
            {deleteError && (
              <p className="text-sm text-red-400 mb-4">{deleteError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setDeleteError("");
                  setShowDeleteModal(false);
                }}
                disabled={deleting}
                className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded hover:bg-zinc-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRoom}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Room"}
              </button>
            </div>
          </div>
        </div>
      )}

      <MessageList
        key={selectedRoom.id}
        roomId={selectedRoom.id}
        incomingMessages={incomingMessages}
        onIncomingMessagesProcessed={onIncomingMessagesProcessed}
        scrollToLatestSignal={scrollToLatestSignal}
      />

      {/* Typing indicator — always rendered to reserve space and avoid layout shift */}
      <div className="px-4 text-sm text-zinc-400 italic h-7 shrink-0">
        {typingUsernames.length > 0 && formatTypingText(typingUsernames)}
      </div>

      <MessageInput
        roomId={selectedRoom.id}
        onMessageSent={() => setScrollToLatestSignal((prev) => prev + 1)}
      />
    </div>
  );
}
