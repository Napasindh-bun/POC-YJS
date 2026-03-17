"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import type {
  CanvasAction,
  CanvasElement,
  Collaborator,
} from "@/lib/types";
import { COLLABORATOR_COLORS } from "@/lib/types";

// Server sync API endpoints
const STREAM_API = "/api/collaboration/stream";
const PUSH_API = "/api/collaboration/push";

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
  const eventSourceRef = useRef<EventSource | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const docRef = useRef<Y.Doc | null>(null);
  const elementsMapRef = useRef<Y.Map<CanvasElement> | null>(null);

  const getUserColor = useCallback((id: string) => {
    const colorIndex = Array.from(id).reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0
    ) % COLLABORATOR_COLORS.length;
    return COLLABORATOR_COLORS[colorIndex];
  }, []);

  const getOrderedElements = useCallback(() => {
    const elementsMap = elementsMapRef.current;
    if (!elementsMap) return [];
    return Array.from(elementsMap.values()).sort((a, b) => a.zIndex - b.zIndex);
  }, []);

  // Read all collaborators from Yjs presence map
  const syncCollaboratorsFromPresence = useCallback(() => {
    const doc = docRef.current;
    if (!doc) {
      setCollaborators([]);
      return;
    }
    const presenceMap = doc.getMap<Collaborator>("presence");
    // filter out self
    const next = Array.from(presenceMap.values()).filter(c => c.id !== userId);
    setCollaborators(next);
  }, []);

  // Connect to Yjs WebRTC provider (P2P)
  useEffect(() => {
    const doc = new Y.Doc();
    const elementsMap = doc.getMap<CanvasElement>("elements");
    docRef.current = doc;
    elementsMapRef.current = elementsMap;

    // Connect to server via SSE
    const params = new URLSearchParams({
      roomId,
      userId,
      userName,
    });
    const eventSource = new EventSource(`${STREAM_API}?${params.toString()}`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
    };
    eventSource.onerror = () => {
      setIsConnected(false);
    };
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "init" && data.update) {
        Y.applyUpdate(doc, new Uint8Array(data.update));
        dispatch({ type: "SET_ELEMENTS", elements: getOrderedElements() });
        syncCollaboratorsFromPresence();
      } else if (data.type === "yjs-update" && data.update) {
        Y.applyUpdate(doc, new Uint8Array(data.update));
        dispatch({ type: "SET_ELEMENTS", elements: getOrderedElements() });
        syncCollaboratorsFromPresence();
      }
    };

    elementsMap.observe((event, transaction) => {
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
    });

    // Observe presence map for collaborator changes
    const presenceMap = doc.getMap<Collaborator>("presence");
    const onPresenceChange = () => {
      syncCollaboratorsFromPresence();
    };
    presenceMap.observe(onPresenceChange);

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
      presenceMap.unobserve(onPresenceChange);
      doc.destroy();
      docRef.current = null;
      elementsMapRef.current = null;
      setCollaborators([]);
      setIsConnected(false);
    };
  }, [roomId, userId, userName, dispatch]);

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
        }
        if (type === "element-update") {
          const patch = payload.element as (Partial<CanvasElement> & { id: string }) | undefined;
          if (!patch) return;
          const existing = elementsMap.get(patch.id);
          if (!existing) return;
          elementsMap.set(patch.id, { ...existing, ...patch });
        }
        if (type === "element-delete") {
          const elementId = payload.elementId as string | undefined;
          if (!elementId) return;
          elementsMap.delete(elementId);
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

      // Push update to server
      const update = Y.encodeStateAsUpdate(doc);
      fetch(PUSH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          userId,
          action: {
            type: "yjs-update",
            update: Array.from(update),
          },
        }),
      });
    },
    [roomId, userId]
  );

  const sendCursorMove = useCallback(
    (x: number, y: number) => {
      const doc = docRef.current;
      if (!doc) return;
      const presenceMap = doc.getMap<Collaborator>("presence");
      const current = presenceMap.get(userId);
      if (!current) return;
      presenceMap.set(userId, {
        ...current,
        cursor: { x, y },
      });

      // Push update to server
      const update = Y.encodeStateAsUpdate(doc);
      fetch(PUSH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          userId,
          action: {
            type: "yjs-update",
            update: Array.from(update),
          },
        }),
      });
    },
    [roomId, userId]
  );

  const sendSelectionChange = useCallback(
    (elementId: string | null) => {
      const doc = docRef.current;
      if (!doc) return;
      const presenceMap = doc.getMap<Collaborator>("presence");
      const current = presenceMap.get(userId);
      if (!current) return;
      presenceMap.set(userId, {
        ...current,
        selectedElementId: elementId,
      });

      // Push update to server
      const update = Y.encodeStateAsUpdate(doc);
      fetch(PUSH_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          userId,
          action: {
            type: "yjs-update",
            update: Array.from(update),
          },
        }),
      });
    },
    [roomId, userId]
  );

  // ฟังก์ชันสำหรับ access Yjs document (ใช้สำหรับ localStorage persistence)
  const getDoc = useCallback(() => {
    return docRef.current;
  }, []);

  return {
    collaborators,
    isConnected,
    sendMutation,
    sendCursorMove,
    sendSelectionChange,
    getDoc,
  };
}
