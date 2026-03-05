"use client";

import { useState, useCallback, useRef } from "react";
import type { CanvasElement } from "@/lib/types";

const MAX_HISTORY = 50;

export function useHistory() {
  const [undoStack, setUndoStack] = useState<CanvasElement[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasElement[][]>([]);
  const lastPush = useRef<number>(0);

  const pushHistory = useCallback(
    (elements: CanvasElement[]) => {
      const now = Date.now();
      // Debounce rapid pushes (within 100ms)
      if (now - lastPush.current < 100) return;
      lastPush.current = now;

      setUndoStack((prev) => {
        const next = [...prev, elements.map((e) => ({ ...e }))];
        if (next.length > MAX_HISTORY) next.shift();
        return next;
      });
      setRedoStack([]);
    },
    []
  );

  const undo = useCallback(
    (currentElements: CanvasElement[]): CanvasElement[] | null => {
      if (undoStack.length === 0) return null;
      const prev = undoStack[undoStack.length - 1];
      setUndoStack((s) => s.slice(0, -1));
      setRedoStack((s) => [...s, currentElements.map((e) => ({ ...e }))]);
      return prev;
    },
    [undoStack]
  );

  const redo = useCallback(
    (currentElements: CanvasElement[]): CanvasElement[] | null => {
      if (redoStack.length === 0) return null;
      const next = redoStack[redoStack.length - 1];
      setRedoStack((s) => s.slice(0, -1));
      setUndoStack((s) => [...s, currentElements.map((e) => ({ ...e }))]);
      return next;
    },
    [redoStack]
  );

  return {
    pushHistory,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  };
}
