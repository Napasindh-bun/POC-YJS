import { NextResponse } from "next/server";
import {
  applyYjsUpdate,
  broadcastToRoom,
} from "@/lib/collaboration-store";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId, userId, action } = body;

    if (!roomId || !userId || !action) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (action.type !== "yjs-update") {
      return NextResponse.json(
        { error: "Unknown action type" },
        { status: 400 }
      );
    }

    const update = new Uint8Array(action.update || []);
    if (update.length > 0) {
      applyYjsUpdate(roomId, update);
      broadcastToRoom(
        roomId,
        {
          type: "yjs-update",
          update: Array.from(update),
          senderId: userId,
        },
        userId
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
