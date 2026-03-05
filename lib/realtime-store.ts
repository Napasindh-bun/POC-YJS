import {
  getCollaborationPersistenceAdapter,
} from "@/lib/collaboration-persistence";
import type {
  AppliedMutation,
  CanvasElement,
  CollabMutation,
  Collaborator,
} from "@/lib/types";

interface RealtimeRoom {
  elements: CanvasElement[];
  version: number;
  collaborators: Map<string, Collaborator>;
  seenOpIds: Set<string>;
  loaded: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, RealtimeRoom>();

function getOrCreateRoom(roomId: string): RealtimeRoom {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      elements: [],
      version: 0,
      collaborators: new Map(),
      seenOpIds: new Set(),
      loaded: false,
      saveTimer: null,
    });
  }
  return rooms.get(roomId)!;
}

export async function ensureRoomLoaded(roomId: string) {
  const room = getOrCreateRoom(roomId);
  if (room.loaded) return room;
  room.loaded = true;

  const snapshot = await getCollaborationPersistenceAdapter().loadRoomSnapshot(roomId);
  if (snapshot) {
    room.elements = snapshot.elements;
    room.version = snapshot.version;
  }

  return room;
}

function schedulePersist(roomId: string) {
  const room = getOrCreateRoom(roomId);
  if (room.saveTimer) clearTimeout(room.saveTimer);

  room.saveTimer = setTimeout(() => {
    void getCollaborationPersistenceAdapter().saveRoomSnapshot(
      roomId,
      room.elements,
      room.version
    );
  }, 300);
}

export async function getRoomSnapshot(roomId: string) {
  const room = await ensureRoomLoaded(roomId);
  return {
    elements: room.elements,
    version: room.version,
    collaborators: Array.from(room.collaborators.values()),
  };
}

export async function upsertCollaborator(roomId: string, collaborator: Collaborator) {
  const room = await ensureRoomLoaded(roomId);
  room.collaborators.set(collaborator.id, collaborator);
}

export function removeCollaborator(roomId: string, collaboratorId: string) {
  const room = getOrCreateRoom(roomId);
  room.collaborators.delete(collaboratorId);
}

export function updateCollaboratorCursor(
  roomId: string,
  collaboratorId: string,
  cursor: { x: number; y: number } | null
) {
  const room = getOrCreateRoom(roomId);
  const collab = room.collaborators.get(collaboratorId);
  if (collab) collab.cursor = cursor;
}

export function updateCollaboratorSelection(
  roomId: string,
  collaboratorId: string,
  elementId: string | null
) {
  const room = getOrCreateRoom(roomId);
  const collab = room.collaborators.get(collaboratorId);
  if (collab) collab.selectedElementId = elementId;
}

function upsertElement(elements: CanvasElement[], patch: Partial<CanvasElement> & { id: string }) {
  const idx = elements.findIndex((el) => el.id === patch.id);
  if (idx === -1) return;
  elements[idx] = { ...elements[idx], ...patch };
}

function applySingleMutation(room: RealtimeRoom, mutation: CollabMutation): AppliedMutation | null {
  if (room.seenOpIds.has(mutation.opId)) {
    return null;
  }

  room.seenOpIds.add(mutation.opId);
  if (room.seenOpIds.size > 5000) {
    room.seenOpIds = new Set(Array.from(room.seenOpIds).slice(-2500));
  }

  switch (mutation.type) {
    case "element-add": {
      const element = mutation.payload.element as CanvasElement | undefined;
      if (!element) return null;
      room.elements.push(element);
      break;
    }
    case "element-update": {
      const element = mutation.payload.element as
        | (Partial<CanvasElement> & { id: string })
        | undefined;
      if (!element) return null;
      upsertElement(room.elements, element);
      break;
    }
    case "element-delete": {
      const elementId = mutation.payload.elementId as string | undefined;
      if (!elementId) return null;
      room.elements = room.elements.filter((el) => el.id !== elementId);
      break;
    }
    case "elements-reorder": {
      const elements = mutation.payload.elements as CanvasElement[] | undefined;
      if (!elements) return null;
      room.elements = elements;
      break;
    }
    default:
      return null;
  }

  room.version += 1;

  return {
    type: mutation.type,
    payload: mutation.payload,
    senderId: "",
    version: room.version,
    opId: mutation.opId,
  };
}

export async function applyMutations(
  roomId: string,
  senderId: string,
  mutations: CollabMutation[]
) {
  const room = await ensureRoomLoaded(roomId);
  const applied: AppliedMutation[] = [];

  for (const mutation of mutations) {
    const normalized: CollabMutation = {
      ...mutation,
      baseVersion:
        typeof mutation.baseVersion === "number"
          ? mutation.baseVersion
          : room.version,
    };

    const result = applySingleMutation(room, normalized);
    if (result) {
      applied.push({ ...result, senderId });
    }
  }

  if (applied.length > 0) {
    schedulePersist(roomId);
  }

  return {
    applied,
    version: room.version,
  };
}
