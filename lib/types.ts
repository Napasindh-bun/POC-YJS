export type ElementType =
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "image"
  | "freedraw";

export type ToolType =
  | "select"
  | "rect"
  | "circle"
  | "ellipse"
  | "line"
  | "arrow"
  | "text"
  | "freedraw"
  | "image"
  | "hand";

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  radiusX?: number;
  radiusY?: number;
  points?: number[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  fontStyle?: string;
  textDecoration?: string;
  align?: "left" | "center" | "right";
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  opacity?: number;
  src?: string;
  draggable: boolean;
  locked: boolean;
  visible: boolean;
  name: string;
  zIndex: number;
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor: { x: number; y: number } | null;
  selectedElementId: string | null;
}

export interface RoomState {
  elements: CanvasElement[];
  collaborators: Map<string, Collaborator>;
}

export type MutationType =
  | "element-add"
  | "element-update"
  | "element-delete"
  | "elements-reorder";

export interface CollabMutation {
  opId: string;
  type: MutationType;
  payload: Record<string, unknown>;
  baseVersion: number;
  ts: number;
}

export interface AppliedMutation {
  type: MutationType;
  payload: Record<string, unknown>;
  senderId: string;
  version: number;
  opId: string;
}

export type CollabEvent =
  | { type: "init"; update: number[] }
  | { type: "yjs-update"; update: number[]; senderId: string };

export interface CanvasState {
  elements: CanvasElement[];
  selectedIds: string[];
  tool: ToolType;
  zoom: number;
  panX: number;
  panY: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  fontSize: number;
  fontFamily: string;
  isDrawing: boolean;
  clipboard: CanvasElement[];
}

export type CanvasAction =
  | { type: "ADD_ELEMENT"; element: CanvasElement }
  | {
      type: "UPDATE_ELEMENT";
      id: string;
      updates: Partial<CanvasElement>;
    }
  | { type: "DELETE_ELEMENTS"; ids: string[] }
  | { type: "SELECT_ELEMENTS"; ids: string[] }
  | { type: "SET_TOOL"; tool: ToolType }
  | { type: "SET_ZOOM"; zoom: number }
  | { type: "SET_PAN"; panX: number; panY: number }
  | { type: "SET_FILL_COLOR"; color: string }
  | { type: "SET_STROKE_COLOR"; color: string }
  | { type: "SET_STROKE_WIDTH"; width: number }
  | { type: "SET_FONT_SIZE"; size: number }
  | { type: "SET_FONT_FAMILY"; family: string }
  | { type: "SET_IS_DRAWING"; isDrawing: boolean }
  | { type: "SET_CLIPBOARD"; elements: CanvasElement[] }
  | { type: "SET_ELEMENTS"; elements: CanvasElement[] }
  | { type: "REORDER_ELEMENT"; id: string; direction: "up" | "down" | "top" | "bottom" }
  | { type: "TOGGLE_ELEMENT_VISIBILITY"; id: string }
  | { type: "TOGGLE_ELEMENT_LOCK"; id: string };

export const COLLABORATOR_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f97316",
  "#ec4899",
  "#06b6d4",
  "#eab308",
  "#8b5cf6",
  "#14b8a6",
  "#f43f5e",
];

export const FONT_FAMILIES = [
  "Arial",
  "Helvetica",
  "Times New Roman",
  "Georgia",
  "Courier New",
  "Verdana",
  "Impact",
  "Comic Sans MS",
];

export function createDefaultElement(
  type: ElementType,
  x: number,
  y: number,
  overrides?: Partial<CanvasElement>
): CanvasElement {
  const base: CanvasElement = {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    fill: "#3b82f6",
    stroke: "#1e40af",
    strokeWidth: 2,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    opacity: 1,
    draggable: true,
    locked: false,
    visible: true,
    name: type.charAt(0).toUpperCase() + type.slice(1),
    zIndex: Date.now(),
    ...overrides,
  };

  switch (type) {
    case "rect":
      return { ...base, width: 150, height: 100, ...overrides };
    case "circle":
      return { ...base, radius: 60, ...overrides };
    case "ellipse":
      return { ...base, radiusX: 80, radiusY: 50, ...overrides };
    case "line":
      return {
        ...base,
        points: [0, 0, 200, 0],
        fill: undefined,
        stroke: "#1e40af",
        strokeWidth: 3,
        ...overrides,
      };
    case "arrow":
      return {
        ...base,
        points: [0, 0, 200, 0],
        fill: undefined,
        stroke: "#1e40af",
        strokeWidth: 3,
        ...overrides,
      };
    case "text":
      return {
        ...base,
        text: "Double-click to edit",
        fontSize: 24,
        fontFamily: "Arial",
        fontStyle: "normal",
        fill: "#0f172a",
        stroke: undefined,
        strokeWidth: 0,
        width: 250,
        ...overrides,
      };
    case "freedraw":
      return {
        ...base,
        points: [],
        fill: undefined,
        stroke: "#0f172a",
        strokeWidth: 3,
        ...overrides,
      };
    case "image":
      return { ...base, width: 200, height: 200, ...overrides };
    default:
      return base;
  }
}
