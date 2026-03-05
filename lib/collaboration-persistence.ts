import type { CanvasElement } from "@/lib/types";

export interface CollaborationPersistenceAdapter {
  loadRoomSnapshot(
    roomId: string
  ): Promise<{ elements: CanvasElement[]; version: number } | null>;
  saveRoomSnapshot(
    roomId: string,
    elements: CanvasElement[],
    version: number
  ): Promise<void>;
}

class InMemoryCollaborationPersistence
  implements CollaborationPersistenceAdapter
{
  private snapshots = new Map<
    string,
    { elements: CanvasElement[]; version: number }
  >();

  async loadRoomSnapshot(roomId: string) {
    const snapshot = this.snapshots.get(roomId);
    if (!snapshot) return null;
    return {
      elements: snapshot.elements.map((el) => ({ ...el })),
      version: snapshot.version,
    };
  }

  async saveRoomSnapshot(
    roomId: string,
    elements: CanvasElement[],
    version: number
  ) {
    this.snapshots.set(roomId, {
      elements: elements.map((el) => ({ ...el })),
      version,
    });
  }
}

let persistenceAdapter: CollaborationPersistenceAdapter =
  new InMemoryCollaborationPersistence();

export function setCollaborationPersistenceAdapter(
  adapter: CollaborationPersistenceAdapter
) {
  persistenceAdapter = adapter;
}

export function getCollaborationPersistenceAdapter() {
  return persistenceAdapter;
}
