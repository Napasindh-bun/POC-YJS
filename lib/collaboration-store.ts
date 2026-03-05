import * as Y from "yjs";
import type { Collaborator, CollabEvent } from "./types";

interface RoomData {
  yDoc: Y.Doc;
  controllers: Map<string, ReadableStreamDefaultController>;
}

const rooms = new Map<string, RoomData>();

export function getOrCreateRoom(roomId: string): RoomData {
  if (!rooms.has(roomId)) {
    const yDoc = new Y.Doc();
    yDoc.getMap("elements");
    yDoc.getMap("presence");

    rooms.set(roomId, {
      yDoc,
      controllers: new Map(),
    });
  }
  return rooms.get(roomId)!;
}

export function getYjsState(roomId: string): number[] {
  const room = getOrCreateRoom(roomId);
  return Array.from(Y.encodeStateAsUpdate(room.yDoc));
}

export function applyYjsUpdate(roomId: string, update: Uint8Array) {
  const room = getOrCreateRoom(roomId);
  Y.applyUpdate(room.yDoc, update);
}

function applyServerPresenceMutation(
  roomId: string,
  mutator: (presenceMap: Y.Map<Collaborator>) => void
): number[] {
  const room = getOrCreateRoom(roomId);
  const doc = room.yDoc;
  const presenceMap = doc.getMap<Collaborator>("presence");

  let capturedUpdate: Uint8Array | null = null;
  const onUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== "server-presence") return;
    capturedUpdate = capturedUpdate
      ? Y.mergeUpdates([capturedUpdate, update])
      : update;
  };

  doc.on("update", onUpdate);
  doc.transact(() => {
    mutator(presenceMap);
  }, "server-presence");
  doc.off("update", onUpdate);

  return capturedUpdate ? Array.from(capturedUpdate) : [];
}

export function upsertCollaboratorPresence(
  roomId: string,
  collaborator: Collaborator
): number[] {
  return applyServerPresenceMutation(roomId, (presenceMap) => {
    presenceMap.set(collaborator.id, collaborator);
  });
}

export function removeCollaboratorPresence(
  roomId: string,
  collaboratorId: string
): number[] {
  return applyServerPresenceMutation(roomId, (presenceMap) => {
    presenceMap.delete(collaboratorId);
  });
}

export function addController(
  roomId: string,
  userId: string,
  controller: ReadableStreamDefaultController
) {
  const room = getOrCreateRoom(roomId);
  room.controllers.set(userId, controller);
}

export function removeController(roomId: string, userId: string) {
  const room = getOrCreateRoom(roomId);
  room.controllers.delete(userId);

  if (room.controllers.size === 0) {
    // Keep room data for a while in case someone reconnects
  }
}

export function broadcastToRoom(
  roomId: string,
  event: CollabEvent,
  excludeUserId?: string
) {
  const room = getOrCreateRoom(roomId);
  const data = `data: ${JSON.stringify(event)}\n\n`;

  room.controllers.forEach((controller, id) => {
    if (id !== excludeUserId) {
      try {
        controller.enqueue(new TextEncoder().encode(data));
      } catch {
        room.controllers.delete(id);
      }
    }
  });
}
