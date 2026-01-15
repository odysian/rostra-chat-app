import { useState } from "react";
import RoomList from "./RoomList";
import MessageArea from "./MessageArea";

export default function ChatLayout() {
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  return (
    <div className="flex h-screen bg-zinc-950">
      <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h1 className="text-xl font-bold text-amber-500">Rostra</h1>
        </div>
        <RoomList
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
        />
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col">
        <MessageArea selectedRoomId={selectedRoomId} />
      </div>
    </div>
  );
}
