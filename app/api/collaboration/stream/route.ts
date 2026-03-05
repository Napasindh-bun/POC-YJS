import {
  getOrCreateRoom,
  addController,
  removeController,
  getYjsState,
  broadcastToRoom,
  upsertCollaboratorPresence,
  removeCollaboratorPresence,
} from "@/lib/collaboration-store";
import { COLLABORATOR_COLORS } from "@/lib/types";
import type { Collaborator } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get("roomId") || "default";
  const userId = searchParams.get("userId") || crypto.randomUUID();
  const userName = searchParams.get("userName") || "Anonymous";

  getOrCreateRoom(roomId);
  const userColorIndex = Array.from(userId).reduce(
    (sum, ch) => sum + ch.charCodeAt(0),
    0
  ) % COLLABORATOR_COLORS.length;

  const collaborator: Collaborator = {
    id: userId,
    name: userName,
    color: COLLABORATOR_COLORS[userColorIndex],
    cursor: null,
    selectedElementId: null,
  };

  const stream = new ReadableStream({
    start(controller) {
      addController(roomId, userId, controller);

      const joinUpdate = upsertCollaboratorPresence(roomId, collaborator);
      if (joinUpdate.length > 0) {
        broadcastToRoom(
          roomId,
          { type: "yjs-update", update: joinUpdate, senderId: userId },
          userId
        );
      }

      // Send init event to the connecting user
      const initEvent = {
        type: "init" as const,
        update: getYjsState(roomId),
      };
      const initData = `data: ${JSON.stringify(initEvent)}\n\n`;
      controller.enqueue(new TextEncoder().encode(initData));

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(
            new TextEncoder().encode(`: heartbeat\n\n`)
          );
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on close
      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        removeController(roomId, userId);
        const leaveUpdate = removeCollaboratorPresence(roomId, userId);
        if (leaveUpdate.length > 0) {
          broadcastToRoom(roomId, {
            type: "yjs-update",
            update: leaveUpdate,
            senderId: userId,
          });
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
