import { RoomWorkspace } from "@/components/room-workspace";

export default async function RoomPage({ params }: PageProps<"/rooms/[roomId]">) {
  const { roomId } = await params;
  return <RoomWorkspace roomId={roomId} />;
}
