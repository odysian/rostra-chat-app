export function formatRoomNameForDisplay(roomName: string): string {
  return roomName.replace(/\s/g, "-");
}
