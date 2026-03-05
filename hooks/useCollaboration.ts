"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import type {
  CanvasAction,
  CanvasElement,
  Collaborator,
} from "@/lib/types";
import { COLLABORATOR_COLORS } from "@/lib/types";

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
  const providerRef = useRef<WebrtcProvider | null>(null);

  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const cursorThrottleRef = useRef<number>(0);
  const docRef = useRef<Y.Doc | null>(null);
  const elementsMapRef = useRef<Y.Map<CanvasElement> | null>(null);

  // DEBUG LOG: Initial config
  useEffect(() => {
    console.log('[YJS-P2P] roomId:', roomId, 'userId:', userId, 'userName:', userName);
    console.log('[YJS-P2P] signaling URLs:', process.env.NEXT_PUBLIC_YJS_SIGNALING_URLS);
    console.log('[YJS-P2P] room password:', process.env.NEXT_PUBLIC_YJS_ROOM_PASSWORD);
  }, [roomId, userId, userName]);

  const getUserColor = useCallback((id: string) => {
    const colorIndex = Array.from(id).reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0
    ) % COLLABORATOR_COLORS.length;
    return COLLABORATOR_COLORS[colorIndex];
  }, []);

  const getSignalingUrls = useCallback(() => {
    const configured = process.env.NEXT_PUBLIC_YJS_SIGNALING_URLS;
    if (!configured) {
      return ["wss://signaling.yjs.dev"];
    }

    return configured
      .split(",")
      .map((url) => url.trim())
      .filter(Boolean);
  }, []);

  const getOrderedElements = useCallback(() => {
    const elementsMap = elementsMapRef.current;
    if (!elementsMap) return [];
    return Array.from(elementsMap.values()).sort((a, b) => a.zIndex - b.zIndex);
  }, []);

  const syncCollaboratorsFromAwareness = useCallback(() => {
    const provider = providerRef.current;
    if (!provider) {
      setCollaborators([]);
      return;
    }

    const states = Array.from(provider.awareness.getStates().values()) as Array<
      Partial<Collaborator> | undefined
    >;

    const next = states
      .filter((state): state is Partial<Collaborator> => Boolean(state))
      .map((state) => ({
        id: state.id,
        name: state.name,
        color: state.color,
        cursor: state.cursor ?? null,
        selectedElementId: state.selectedElementId ?? null,
      }))
      .filter((state): state is Collaborator => Boolean(state.id && state.name && state.color))
      .filter((state) => state.id !== userId);

    // DEBUG LOG: Awareness states
    console.log('[YJS-P2P] awareness states:', next);
    setCollaborators(next);
  }, [userId]);

  // Connect to Yjs WebRTC provider (P2P)
  useEffect(() => {
    const doc = new Y.Doc();
    const elementsMap = doc.getMap<CanvasElement>("elements");
    docRef.current = doc;
    elementsMapRef.current = elementsMap;

    const provider = new WebrtcProvider(`canvas-${roomId}`, doc, {
      signaling: getSignalingUrls(),
      password: process.env.NEXT_PUBLIC_YJS_ROOM_PASSWORD || undefined,
    });
    providerRef.current = provider;

    provider.awareness.setLocalState({
      id: userId,
      name: userName,
      color: getUserColor(userId),
      cursor: null,
      selectedElementId: null,
    } as Collaborator);

    // DEBUG LOG: Provider created
    console.log('[YJS-P2P] WebrtcProvider created:', provider);

    const onMapChange = (
      event: Y.YMapEvent<CanvasElement>,
      transaction: Y.Transaction
    ) => {
      if (transaction.origin === LOCAL_YJS_ORIGIN) return;

      event.changes.keys.forEach((change, key) => {
        // DEBUG LOG: Element change
        console.log('[YJS-P2P] element change:', change.action, key);
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

    const onAwarenessChange = () => {
      // DEBUG LOG: Awareness change event
      console.log('[YJS-P2P] awareness change event');
      syncCollaboratorsFromAwareness();
    };

    const onStatus = (event: { connected: boolean }) => {
      // DEBUG LOG: Provider status
      console.log('[YJS-P2P] provider status:', event.connected);
      setIsConnected(event.connected);
    };

    const onSynced = () => {
      // DEBUG LOG: Provider synced
      console.log('[YJS-P2P] provider synced');
      dispatch({ type: "SET_ELEMENTS", elements: getOrderedElements() });
    };

    elementsMap.observe(onMapChange);
    provider.awareness.on("change", onAwarenessChange);
    provider.on("status", onStatus);
    provider.on("synced", onSynced);

    syncCollaboratorsFromAwareness();

    return () => {
      elementsMap.unobserve(onMapChange);
      provider.off("synced", onSynced);
      provider.off("status", onStatus);
      provider.awareness.off("change", onAwarenessChange);
      provider.awareness.setLocalState(null);
      provider.destroy();
      providerRef.current = null;

      doc.destroy();
      docRef.current = null;
      elementsMapRef.current = null;

      setCollaborators([]);
      setIsConnected(false);
    };
  }, [
    roomId,
    userId,
    userName,
    dispatch,
    getSignalingUrls,
    getUserColor,
    getOrderedElements,
    syncCollaboratorsFromAwareness,
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

      const provider = providerRef.current;
      if (!provider) return;

      const current = provider.awareness.getLocalState() as Collaborator | null;
      if (!current) return;

      provider.awareness.setLocalState({
        ...current,
        cursor: { x, y },
      });
    },
    []
  );

  const sendSelectionChange = useCallback(
    (elementId: string | null) => {
      const provider = providerRef.current;
      if (!provider) return;

      const current = provider.awareness.getLocalState() as Collaborator | null;
      if (!current) return;

      provider.awareness.setLocalState({
        ...current,
        selectedElementId: elementId,
      });
    },
    []
  );

  return {
    collaborators,
    isConnected,
    sendMutation,
    sendCursorMove,
    sendSelectionChange,
  };
}
