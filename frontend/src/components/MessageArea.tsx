interface MessageAreaProps {
  selectedRoomId: number | null;
}

export default function MessageArea({ selectedRoomId }: MessageAreaProps) {
  if (!selectedRoomId) {
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
    <div className="flex-1 flex items-center justify-center bg-zinc-950">
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-amber-500">
          Room #{selectedRoomId}
        </h2>
        <p className="text-zinc-400 mt-2">
          Messages will appear here (coming next)
        </p>
      </div>
    </div>
  );
}
