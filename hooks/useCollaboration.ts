"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import type {
  CanvasAction,
  CanvasElement,
  Collaborator,
} from "@/lib/types";

interface UseCollaborationOptions {
  roomId: string;
  userId: string;
  userName: string;
  dispatch: React.Dispatch<CanvasAction>;
}

export function useCollaboration({
  roomId,
  userId,
  userName,
  dispatch,
}: UseCollaborationOptions) {
  const LOCAL_YJS_ORIGIN = "local-yjs";
  const REMOTE_YJS_ORIGIN = "remote-yjs";

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const cursorThrottleRef = useRef<number>(0);
  const docRef = useRef<Y.Doc | null>(null);
  const elementsMapRef = useRef<Y.Map<CanvasElement> | null>(null);
  const presenceMapRef = useRef<Y.Map<Collaborator> | null>(null);

  const getOrderedElements = useCallback(() => {
    const elementsMap = elementsMapRef.current;
    if (!elementsMap) return [];
    return Array.from(elementsMap.values()).sort((a, b) => a.zIndex - b.zIndex);
  }, []);

  const syncCollaboratorsFromPresence = useCallback(() => {
    const presenceMap = presenceMapRef.current;
    if (!presenceMap) {
      setCollaborators([]);
      return;
    }

    const next = Array.from(presenceMap.values()).filter((c) => c.id !== userId);
    setCollaborators(next);
  }, [userId]);

  const sendAction = useCallback(
    async (action: Record<string, unknown>) => {
      await fetch("/api/collaboration/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roomId, userId, action }),
      });
    },
    [roomId, userId]
  );

  // Connect to SSE realtime stream
  useEffect(() => {
    const doc = new Y.Doc();
    const elementsMap = doc.getMap<CanvasElement>("elements");
    const presenceMap = doc.getMap<Collaborator>("presence");
    docRef.current = doc;
    elementsMapRef.current = elementsMap;
    presenceMapRef.current = presenceMap;

    const onDocUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin !== LOCAL_YJS_ORIGIN) return;
      void sendAction({
        type: "yjs-update",
        update: Array.from(update),
      });
    };

    const onMapChange = (
      event: Y.YMapEvent<CanvasElement>,
      transaction: Y.Transaction
    ) => {
      if (transaction.origin === LOCAL_YJS_ORIGIN) return;

      event.changes.keys.forEach((change, key) => {
        if (change.action === "delete") {
          dispatch({ type: "DELETE_ELEMENTS", ids: [key] });
          return;
        }

        const element = elementsMap.get(key);
        if (!element) return;

        if (change.action === "add") {
          dispatch({ type: "ADD_ELEMENT", element });
          return;
        }

        dispatch({ type: "UPDATE_ELEMENT", id: key, updates: element });
      });
    };

    const onPresenceMapChange = () => {
      syncCollaboratorsFromPresence();
    };

    doc.on("update", onDocUpdate);
    elementsMap.observe(onMapChange);
    presenceMap.observe(onPresenceMapChange);

    const params = new URLSearchParams({ roomId, userId, userName });
    const eventSource = new EventSource(`/api/collaboration/stream?${params.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    eventSource.onmessage = (message) => {
      try {
        const event = JSON.parse(message.data) as
          | { type: "init"; update: number[] }
          | { type: "yjs-update"; update: number[]; senderId: string };

        if (event.type === "init") {
          const update = new Uint8Array(event.update || []);
          if (update.length > 0) {
            Y.applyUpdate(doc, update, REMOTE_YJS_ORIGIN);
            dispatch({ type: "SET_ELEMENTS", elements: getOrderedElements() });
          }
          syncCollaboratorsFromPresence();
          return;
        }

        if (event.type === "yjs-update") {
          if (event.senderId === userId) return;
          const update = new Uint8Array(event.update || []);
          if (update.length === 0) return;
          Y.applyUpdate(doc, update, REMOTE_YJS_ORIGIN);
          return;
        }
      } catch {
        // ignore malformed events
      }
    };

    return () => {
      elementsMap.unobserve(onMapChange);
      presenceMap.unobserve(onPresenceMapChange);
      doc.off("update", onDocUpdate);
      doc.destroy();
      docRef.current = null;
      elementsMapRef.current = null;
      presenceMapRef.current = null;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
    };
  }, [
    roomId,
    userId,
    userName,
    dispatch,
    getOrderedElements,
    sendAction,
    syncCollaboratorsFromPresence,
  ]);

  const sendMutation = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      const doc = docRef.current;
      const elementsMap = elementsMapRef.current;
      if (!doc || !elementsMap) return;

      doc.transact(() => {
        if (type === "element-add") {
          const element = payload.element as CanvasElement | undefined;
          if (!element) return;
          elementsMap.set(element.id, element);
          return;
        }

        if (type === "element-update") {
          const patch = payload.element as
            | (Partial<CanvasElement> & { id: string })
            | undefined;
          if (!patch) return;
          const existing = elementsMap.get(patch.id);
          if (!existing) return;
          elementsMap.set(patch.id, { ...existing, ...patch });
          return;
        }

        if (type === "element-delete") {
          const elementId = payload.elementId as string | undefined;
          if (!elementId) return;
          elementsMap.delete(elementId);
          return;
        }

        if (type === "elements-reorder") {
          const elements = payload.elements as CanvasElement[] | undefined;
          if (!elements) return;
          elementsMap.clear();
          elements.forEach((element) => {
            elementsMap.set(element.id, element);
          });
        }
      }, LOCAL_YJS_ORIGIN);
    },
    []
  );

  const sendCursorMove = useCallback(
    (x: number, y: number) => {
      const now = Date.now();
      if (now - cursorThrottleRef.current < 50) return;
      cursorThrottleRef.current = now;

      const doc = docRef.current;
      const presenceMap = presenceMapRef.current;
      if (!doc || !presenceMap) return;

      const current = presenceMap.get(userId);
      if (!current) return;

      doc.transact(() => {
        presenceMap.set(userId, {
          ...current,
          cursor: { x, y },
        });
      }, LOCAL_YJS_ORIGIN);
    },
    [userId]
  );

  const sendSelectionChange = useCallback(
    (elementId: string | null) => {
      const doc = docRef.current;
      const presenceMap = presenceMapRef.current;
      if (!doc || !presenceMap) return;

      const current = presenceMap.get(userId);
      if (!current) return;

      doc.transact(() => {
        presenceMap.set(userId, {
          ...current,
          selectedElementId: elementId,
        });
      }, LOCAL_YJS_ORIGIN);
    },
    [userId]
  );

  return {
    collaborators,
    isConnected,
    sendMutation,
    sendCursorMove,
    sendSelectionChange,
  };
}
