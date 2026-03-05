"use client";

import {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type Dispatch,
} from "react";
import type { CanvasState, CanvasAction, CanvasElement } from "@/lib/types";

const initialState: CanvasState = {
  elements: [],
  selectedIds: [],
  tool: "select",
  zoom: 1,
  panX: 0,
  panY: 0,
  fillColor: "#3b82f6",
  strokeColor: "#1e40af",
  strokeWidth: 2,
  fontSize: 24,
  fontFamily: "Arial",
  isDrawing: false,
  clipboard: [],
};

function canvasReducer(state: CanvasState, action: CanvasAction): CanvasState {
  switch (action.type) {
    case "ADD_ELEMENT":
      return {
        ...state,
        elements: [...state.elements, action.element],
      };
    case "UPDATE_ELEMENT":
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, ...action.updates } : el
        ),
      };
    case "DELETE_ELEMENTS":
      return {
        ...state,
        elements: state.elements.filter(
          (el) => !action.ids.includes(el.id)
        ),
        selectedIds: state.selectedIds.filter(
          (id) => !action.ids.includes(id)
        ),
      };
    case "SELECT_ELEMENTS":
      return { ...state, selectedIds: action.ids };
    case "SET_TOOL":
      return { ...state, tool: action.tool };
    case "SET_ZOOM":
      return { ...state, zoom: Math.max(0.1, Math.min(5, action.zoom)) };
    case "SET_PAN":
      return { ...state, panX: action.panX, panY: action.panY };
    case "SET_FILL_COLOR":
      return { ...state, fillColor: action.color };
    case "SET_STROKE_COLOR":
      return { ...state, strokeColor: action.color };
    case "SET_STROKE_WIDTH":
      return { ...state, strokeWidth: action.width };
    case "SET_FONT_SIZE":
      return { ...state, fontSize: action.size };
    case "SET_FONT_FAMILY":
      return { ...state, fontFamily: action.family };
    case "SET_IS_DRAWING":
      return { ...state, isDrawing: action.isDrawing };
    case "SET_CLIPBOARD":
      return { ...state, clipboard: action.elements };
    case "SET_ELEMENTS":
      return { ...state, elements: action.elements };
    case "REORDER_ELEMENT": {
      const sorted = [...state.elements].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((e) => e.id === action.id);
      if (idx === -1) return state;

      let newElements = [...sorted];
      switch (action.direction) {
        case "up":
          if (idx < sorted.length - 1) {
            const tempUp = newElements[idx].zIndex;
            newElements[idx] = { ...newElements[idx], zIndex: newElements[idx + 1].zIndex };
            newElements[idx + 1] = { ...newElements[idx + 1], zIndex: tempUp };
          }
          break;
        case "down":
          if (idx > 0) {
            const tempDown = newElements[idx].zIndex;
            newElements[idx] = { ...newElements[idx], zIndex: newElements[idx - 1].zIndex };
            newElements[idx - 1] = { ...newElements[idx - 1], zIndex: tempDown };
          }
          break;
        case "top":
          newElements[idx] = {
            ...newElements[idx],
            zIndex: Math.max(...sorted.map((e) => e.zIndex)) + 1,
          };
          break;
        case "bottom":
          newElements[idx] = {
            ...newElements[idx],
            zIndex: Math.min(...sorted.map((e) => e.zIndex)) - 1,
          };
          break;
      }
      return { ...state, elements: newElements };
    }
    case "TOGGLE_ELEMENT_VISIBILITY":
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id ? { ...el, visible: !el.visible } : el
        ),
      };
    case "TOGGLE_ELEMENT_LOCK":
      return {
        ...state,
        elements: state.elements.map((el) =>
          el.id === action.id
            ? { ...el, locked: !el.locked, draggable: el.locked }
            : el
        ),
      };
    default:
      return state;
  }
}

interface CanvasContextType {
  state: CanvasState;
  dispatch: Dispatch<CanvasAction>;
}

export const CanvasContext = createContext<CanvasContextType | null>(null);

export function useCanvasStore() {
  const ctx = useContext(CanvasContext);
  if (!ctx) throw new Error("useCanvasStore must be used within CanvasProvider");
  return ctx;
}

export function useCanvasReducer() {
  return useReducer(canvasReducer, initialState);
}

export function useSelectedElements(): CanvasElement[] {
  const { state } = useCanvasStore();
  return state.elements.filter((el) => state.selectedIds.includes(el.id));
}
