"use client";

import { useEffect, useCallback } from "react";
import type { CanvasElement, ToolType, CanvasAction } from "@/lib/types";
import { createDefaultElement } from "@/lib/types";

interface ShortcutHandlers {
  dispatch: React.Dispatch<CanvasAction>;
  state: {
    elements: CanvasElement[];
    selectedIds: string[];
    clipboard: CanvasElement[];
    tool: ToolType;
  };
  onUndo: () => void;
  onRedo: () => void;
  onExport?: () => void;
  pushHistory: (elements: CanvasElement[]) => void;
  sendMutation?: (type: string, payload: Record<string, unknown>) => void;
}

export function useKeyboardShortcuts({
  dispatch,
  state,
  onUndo,
  onRedo,
  onExport,
  pushHistory,
  sendMutation,
}: ShortcutHandlers) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.contentEditable === "true"
      ) {
        return;
      }

      const isCtrl = e.ctrlKey || e.metaKey;

      // Tool shortcuts
      if (!isCtrl) {
        switch (e.key.toLowerCase()) {
          case "v":
            dispatch({ type: "SET_TOOL", tool: "select" });
            return;
          case "r":
            dispatch({ type: "SET_TOOL", tool: "rect" });
            return;
          case "o":
            dispatch({ type: "SET_TOOL", tool: "circle" });
            return;
          case "t":
            dispatch({ type: "SET_TOOL", tool: "text" });
            return;
          case "p":
            dispatch({ type: "SET_TOOL", tool: "freedraw" });
            return;
          case "l":
            dispatch({ type: "SET_TOOL", tool: "line" });
            return;
          case "h":
            dispatch({ type: "SET_TOOL", tool: "hand" });
            return;
          case "escape":
            dispatch({ type: "SELECT_ELEMENTS", ids: [] });
            dispatch({ type: "SET_TOOL", tool: "select" });
            return;
          case "delete":
          case "backspace":
            if (state.selectedIds.length > 0) {
              e.preventDefault();
              pushHistory(state.elements);
              state.selectedIds.forEach((id) => {
                sendMutation?.("element-delete", { elementId: id });
              });
              dispatch({
                type: "DELETE_ELEMENTS",
                ids: state.selectedIds,
              });
            }
            return;
          case "[":
            if (state.selectedIds.length === 1) {
              dispatch({
                type: "REORDER_ELEMENT",
                id: state.selectedIds[0],
                direction: "down",
              });
            }
            return;
          case "]":
            if (state.selectedIds.length === 1) {
              dispatch({
                type: "REORDER_ELEMENT",
                id: state.selectedIds[0],
                direction: "up",
              });
            }
            return;
        }
      }

      // Ctrl combinations
      if (isCtrl) {
        switch (e.key.toLowerCase()) {
          case "z":
            e.preventDefault();
            if (e.shiftKey) {
              onRedo();
            } else {
              onUndo();
            }
            return;
          case "y":
            e.preventDefault();
            onRedo();
            return;
          case "c":
            if (state.selectedIds.length > 0) {
              e.preventDefault();
              const copied = state.elements.filter((el) =>
                state.selectedIds.includes(el.id)
              );
              dispatch({
                type: "SET_CLIPBOARD",
                elements: copied,
              });
            }
            return;
          case "x":
            if (state.selectedIds.length > 0) {
              e.preventDefault();
              const cut = state.elements.filter((el) =>
                state.selectedIds.includes(el.id)
              );
              dispatch({ type: "SET_CLIPBOARD", elements: cut });
              pushHistory(state.elements);
              state.selectedIds.forEach((id) => {
                sendMutation?.("element-delete", { elementId: id });
              });
              dispatch({
                type: "DELETE_ELEMENTS",
                ids: state.selectedIds,
              });
            }
            return;
          case "v":
            if (state.clipboard.length > 0) {
              e.preventDefault();
              pushHistory(state.elements);
              const newIds: string[] = [];
              state.clipboard.forEach((el) => {
                const newEl = createDefaultElement(el.type, el.x + 20, el.y + 20, {
                  ...el,
                  id: crypto.randomUUID(),
                  x: el.x + 20,
                  y: el.y + 20,
                  name: el.name + " copy",
                  zIndex: Date.now(),
                });
                newIds.push(newEl.id);
                dispatch({ type: "ADD_ELEMENT", element: newEl });
                sendMutation?.("element-add", { element: newEl });
              });
              dispatch({ type: "SELECT_ELEMENTS", ids: newIds });
            }
            return;
          case "d":
            if (state.selectedIds.length > 0) {
              e.preventDefault();
              pushHistory(state.elements);
              const newDupIds: string[] = [];
              state.selectedIds.forEach((id) => {
                const el = state.elements.find((e) => e.id === id);
                if (el) {
                  const dup = {
                    ...el,
                    id: crypto.randomUUID(),
                    x: el.x + 20,
                    y: el.y + 20,
                    name: el.name + " copy",
                    zIndex: Date.now(),
                  };
                  newDupIds.push(dup.id);
                  dispatch({ type: "ADD_ELEMENT", element: dup });
                  sendMutation?.("element-add", { element: dup });
                }
              });
              dispatch({ type: "SELECT_ELEMENTS", ids: newDupIds });
            }
            return;
          case "a":
            e.preventDefault();
            dispatch({
              type: "SELECT_ELEMENTS",
              ids: state.elements.map((el) => el.id),
            });
            return;
          case "s":
            e.preventDefault();
            onExport?.();
            return;
        }
      }
    },
    [dispatch, state, onUndo, onRedo, onExport, pushHistory, sendMutation]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
