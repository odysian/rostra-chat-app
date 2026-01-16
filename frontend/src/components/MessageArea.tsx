import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import type { Room } from "../types";

interface MessageAreaProps {
  selectedRoom: Room | null;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onToggleUsers: () => void;
}

export default function MessageArea({
  selectedRoom,
  sidebarOpen,
  onToggleSidebar,
  onToggleUsers,
}: MessageAreaProps) {
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

  return (
    <div className="flex-1 flex flex-col bg-zinc-950 min-h-0">
      {/* Room Header */}
      <div className="h-14 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="text-zinc-400 hover:text-amber-500 transition-all duration-300"
            title="Toggle sidebar"
          >
            {/* Chevron arrow that rotates */}
            <svg
              className={`w-6 h-6 transition-transform duration-300 ${
                sidebarOpen ? "" : "rotate-180"
              }`}
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
          <h2 className="text-lg font-semibold text-zinc-100">
            # {selectedRoom.name}
          </h2>
        </div>
        <button
          onClick={onToggleUsers}
          className="text-zinc-400 hover:text-amber-500 transition-colors"
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

      {/* Rest stays the same */}
      <MessageList roomId={selectedRoom.id} />
      <MessageInput roomId={selectedRoom.id} />
    </div>
  );
}
