"use client";

import { useRef, useCallback, useState, useEffect } from "react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { createDefaultElement } from "@/lib/types";
import type { CanvasElement, Collaborator } from "@/lib/types";

// We import Konva dynamically inside useEffect to avoid SSR issues
let Konva: typeof import("konva").default | null = null;

interface CanvasEditorProps {
  collaborators: Collaborator[];
  onCursorMove: (x: number, y: number) => void;
  onSelectionChange: (elementId: string | null) => void;
  sendMutation: (type: string, payload: Record<string, unknown>) => void;
  pushHistory: (elements: CanvasElement[]) => void;
  stageRef: React.MutableRefObject<any>;
}

export default function CanvasEditor({
  collaborators,
  onCursorMove,
  onSelectionChange,
  sendMutation,
  pushHistory,
  stageRef,
}: CanvasEditorProps) {
  const { state, dispatch } = useCanvasStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Refs that persist across renders for imperative Konva objects
  const stageObjRef = useRef<any>(null);
  const bgLayerRef = useRef<any>(null);
  const mainLayerRef = useRef<any>(null);
  const cursorLayerRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const shapeMapRef = useRef<Map<string, any>>(new Map());
  const cursorMapRef = useRef<Map<string, any>>(new Map());
  const isDrawingRef = useRef(false);
  const currentDrawIdRef = useRef<string | null>(null);
  const isPanningRef = useRef(false);
  const lastPanPosRef = useRef({ x: 0, y: 0 });
  const imageCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const dragSyncRef = useRef<{
    lastSentAt: number;
    timer: ReturnType<typeof setTimeout> | null;
    pending: Array<{ id: string; x: number; y: number }> | null;
  }>({
    lastSentAt: 0,
    timer: null,
    pending: null,
  });
  const groupDragRef = useRef<{
    anchorId: string | null;
    anchorStart: { x: number; y: number } | null;
    startPositions: Map<string, { x: number; y: number }>;
  }>({
    anchorId: null,
    anchorStart: null,
    startPositions: new Map(),
  });

  // Keep latest state in a ref so event handlers always see current values
  const stateRef = useRef(state);
  stateRef.current = state;
  const collabRef = useRef(collaborators);
  collabRef.current = collaborators;

  const flushPendingDragMutation = useCallback(() => {
    const pending = dragSyncRef.current.pending;
    if (!pending || pending.length === 0) return;

    pending.forEach((update) => {
      sendMutation("element-update", {
        element: { id: update.id, x: update.x, y: update.y },
      });
    });
    dragSyncRef.current.pending = null;
    dragSyncRef.current.lastSentAt = Date.now();
  }, [sendMutation]);

  const sendDragMutationsThrottled = useCallback(
    (updates: Array<{ id: string; x: number; y: number }>) => {
      if (updates.length === 0) return;
      const throttleMs = 33;
      const now = Date.now();

      dragSyncRef.current.pending = updates;

      const elapsed = now - dragSyncRef.current.lastSentAt;
      if (elapsed >= throttleMs) {
        if (dragSyncRef.current.timer) {
          clearTimeout(dragSyncRef.current.timer);
          dragSyncRef.current.timer = null;
        }
        flushPendingDragMutation();
        return;
      }

      if (!dragSyncRef.current.timer) {
        dragSyncRef.current.timer = setTimeout(() => {
          dragSyncRef.current.timer = null;
          flushPendingDragMutation();
        }, throttleMs - elapsed);
      }
    },
    [flushPendingDragMutation]
  );

  useEffect(() => {
    return () => {
      if (dragSyncRef.current.timer) {
        clearTimeout(dragSyncRef.current.timer);
        dragSyncRef.current.timer = null;
      }
      dragSyncRef.current.pending = null;
    };
  }, []);

  // Initialize Konva stage
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    import("konva").then((mod) => {
      if (cancelled) return;
      Konva = mod.default;

      if (!containerRef.current || stageObjRef.current) return;

      const stage = new Konva.Stage({
        container: containerRef.current,
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
      });

      const bgLayer = new Konva.Layer({ listening: false });
      const mainLayer = new Konva.Layer();
      const cursorLayer = new Konva.Layer({ listening: false });

      stage.add(bgLayer);
      stage.add(mainLayer);
      stage.add(cursorLayer);

      // Background rect
      const bgRect = new Konva.Rect({
        x: -5000,
        y: -5000,
        width: 10000,
        height: 10000,
        fill: "#f8fafc",
        listening: false,
      });
      bgLayer.add(bgRect);

      // Grid lines
      const gridSize = 40;
      for (let i = -2000; i <= 2000; i += gridSize) {
        bgLayer.add(
          new Konva.Line({
            points: [i, -2000, i, 2000],
            stroke: "#e2e8f0",
            strokeWidth: 0.5,
            listening: false,
          })
        );
        bgLayer.add(
          new Konva.Line({
            points: [-2000, i, 2000, i],
            stroke: "#e2e8f0",
            strokeWidth: 0.5,
            listening: false,
          })
        );
      }

      bgLayer.batchDraw();

      // Transformer
      const tr = new Konva.Transformer({
        anchorFill: "#ffffff",
        anchorStroke: "#0ea5e9",
        anchorSize: 8,
        anchorCornerRadius: 2,
        borderStroke: "#0ea5e9",
        borderStrokeWidth: 1.5,
        borderDash: [4, 4],
        rotateAnchorOffset: 20,
        keepRatio: false,
        rotateEnabled: true,
        enabledAnchors: [
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
          "middle-left",
          "middle-right",
          "top-center",
          "bottom-center",
        ],
        boundBoxFunc: (oldBox: any, newBox: any) => {
          if (Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5) {
            return oldBox;
          }
          return newBox;
        },
      });
      mainLayer.add(tr);

      stageObjRef.current = stage;
      stageRef.current = stage;
      bgLayerRef.current = bgLayer;
      mainLayerRef.current = mainLayer;
      cursorLayerRef.current = cursorLayer;
      transformerRef.current = tr;

      setReady(true);
    });

    return () => {
      cancelled = true;
      if (stageObjRef.current) {
        stageObjRef.current.destroy();
        stageObjRef.current = null;
        stageRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !stageObjRef.current) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (stageObjRef.current) {
          stageObjRef.current.width(width);
          stageObjRef.current.height(height);
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [ready]);

  // Helper: get pointer position in canvas coordinates
  const getPointerPosition = useCallback((): { x: number; y: number } | null => {
    const stage = stageObjRef.current;
    if (!stage) return null;
    const pos = stage.getPointerPosition();
    if (!pos) return null;
    const transform = stage.getAbsoluteTransform().copy().invert();
    return transform.point(pos);
  }, []);

  // Helper: create a Konva shape from element data
  const createShape = useCallback((el: CanvasElement): any => {
    if (!Konva) return null;
    const KonvaLib = Konva;

    const userId = collaborators.find(c => c.id)?.id || "";
    const common: any = {
      id: el.id,
      name: el.id,
      x: el.x,
      y: el.y,
      rotation: el.rotation || 0,
      scaleX: el.scaleX || 1,
      scaleY: el.scaleY || 1,
      opacity: el.opacity ?? 1,
      draggable: el.draggable && (!el.lockedBy || el.lockedBy === userId),
      strokeScaleEnabled: false,
    };

    let shape: any = null;

    switch (el.type) {
      case "rect":
        shape = new KonvaLib.Rect({
          ...common,
          width: el.width || 150,
          height: el.height || 100,
          fill: el.fill,
          stroke: el.stroke,
          strokeWidth: el.strokeWidth,
          cornerRadius: 4,
        });
        break;
      case "circle":
        shape = new KonvaLib.Circle({
          ...common,
          radius: el.radius || 60,
          fill: el.fill,
          stroke: el.stroke,
          strokeWidth: el.strokeWidth,
        });
        break;
      case "ellipse":
        shape = new KonvaLib.Ellipse({
          ...common,
          radiusX: el.radiusX || 80,
          radiusY: el.radiusY || 50,
          fill: el.fill,
          stroke: el.stroke,
          strokeWidth: el.strokeWidth,
        });
        break;
      case "line":
        shape = new KonvaLib.Line({
          ...common,
          points: el.points || [0, 0, 200, 0],
          stroke: el.stroke || "#1e40af",
          strokeWidth: el.strokeWidth || 3,
          hitStrokeWidth: 20,
        });
        break;
      case "arrow":
        shape = new KonvaLib.Arrow({
          ...common,
          points: el.points || [0, 0, 200, 0],
          stroke: el.stroke || "#1e40af",
          strokeWidth: el.strokeWidth || 3,
          fill: el.stroke || "#1e40af",
          pointerLength: 12,
          pointerWidth: 12,
          hitStrokeWidth: 20,
        });
        break;
      case "text":
        shape = new KonvaLib.Text({
          ...common,
          text: el.text || "Double-click to edit",
          fontSize: el.fontSize || 24,
          fontFamily: el.fontFamily || "Arial",
          fontStyle: el.fontStyle || "normal",
          textDecoration: el.textDecoration || "",
          fill: el.fill || "#0f172a",
          width: el.width || 250,
          align: el.align || "left",
          padding: 8,
        });
        break;
      case "freedraw":
        shape = new KonvaLib.Line({
          ...common,
          points: el.points || [],
          stroke: el.stroke || "#0f172a",
          strokeWidth: el.strokeWidth || 3,
          tension: 0.5,
          lineCap: "round",
          lineJoin: "round",
          globalCompositeOperation: "source-over",
          hitStrokeWidth: 20,
        });
        break;
      case "image": {
        shape = new KonvaLib.Rect({
          ...common,
          width: el.width || 200,
          height: el.height || 200,
          fill: "#e2e8f0",
        });
        // Load image async
        if (el.src) {
          const cached = imageCache.current.get(el.src);
          if (cached) {
            const imgShape = new KonvaLib.Image({
              ...common,
              image: cached,
              width: el.width || 200,
              height: el.height || 200,
            });
            // We'll replace the placeholder in mainLayer
            setTimeout(() => {
              const placeholder = shapeMapRef.current.get(el.id);
              if (placeholder && mainLayerRef.current) {
                const idx = placeholder.getZIndex();
                placeholder.destroy();
                mainLayerRef.current.add(imgShape);
                imgShape.moveToBottom();
                // Bring back to correct position
                for (let i = 0; i < idx; i++) imgShape.moveUp();
                shapeMapRef.current.set(el.id, imgShape);
                attachShapeEvents(imgShape, el.id);
                mainLayerRef.current.batchDraw();
              }
            }, 0);
          } else {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.src = el.src;
            img.onload = () => {
              imageCache.current.set(el.src!, img);
              const imgShape = new KonvaLib.Image({
                ...common,
                image: img,
                width: el.width || 200,
                height: el.height || 200,
              });
              const placeholder = shapeMapRef.current.get(el.id);
              if (placeholder && mainLayerRef.current) {
                placeholder.destroy();
                mainLayerRef.current.add(imgShape);
                shapeMapRef.current.set(el.id, imgShape);
                attachShapeEvents(imgShape, el.id);
                mainLayerRef.current.batchDraw();
              }
            };
          }
        }
        break;
      }
      default:
        return null;
    }

    return shape;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Attach event listeners to a shape
  const attachShapeEvents = useCallback(
    (shape: any, elId: string) => {
      shape.on("click tap", (e: any) => {
        if (stateRef.current.tool !== "select") return;
        const shiftKey = e.evt?.shiftKey || false;
        const currentIds = stateRef.current.selectedIds;
        const newIds = shiftKey
          ? currentIds.includes(elId)
            ? currentIds.filter((s: string) => s !== elId)
            : [...currentIds, elId]
          : [elId];
        dispatch({ type: "SELECT_ELEMENTS", ids: newIds });
        onSelectionChange(newIds.length === 1 ? newIds[0] : null);
      });

      shape.on("dragstart", () => {
        const userId = collaborators.find(c => c.id)?.id || "";
        const el = stateRef.current.elements.find((e: CanvasElement) => e.id === elId);
        if (el && el.lockedBy && el.lockedBy !== userId) {
          // Node ถูก lock โดยคนอื่น
          return;
        }
        // Lock node
        sendMutation("element-update", { element: { id: elId, lockedBy: userId } });
        pushHistory(stateRef.current.elements);

        const selectedIds = stateRef.current.selectedIds;
        if (!selectedIds.includes(elId) || selectedIds.length <= 1) {
          groupDragRef.current.anchorId = null;
          groupDragRef.current.anchorStart = null;
          groupDragRef.current.startPositions.clear();
          return;
        }

        const startPositions = new Map<string, { x: number; y: number }>();
        selectedIds.forEach((id) => {
          const selectedEl = stateRef.current.elements.find((el) => el.id === id);
          if (selectedEl) {
            startPositions.set(id, { x: selectedEl.x, y: selectedEl.y });
          }
        });

        if (startPositions.size > 1) {
          groupDragRef.current.anchorId = elId;
          groupDragRef.current.anchorStart = { x: shape.x(), y: shape.y() };
          groupDragRef.current.startPositions = startPositions;
        }
      });

      shape.on("dragmove", (e: any) => {
        const x = e.target.x();
        const y = e.target.y();

        const isGroupDrag =
          groupDragRef.current.anchorId === elId &&
          groupDragRef.current.anchorStart &&
          groupDragRef.current.startPositions.size > 1;

        if (isGroupDrag) {
          const anchorStart = groupDragRef.current.anchorStart!;
          const dx = x - anchorStart.x;
          const dy = y - anchorStart.y;
          const updates: Array<{ id: string; x: number; y: number }> = [];

          groupDragRef.current.startPositions.forEach((startPos, id) => {
            const next = { x: startPos.x + dx, y: startPos.y + dy };
            dispatch({ type: "UPDATE_ELEMENT", id, updates: next });
            updates.push({ id, ...next });
          });

          sendDragMutationsThrottled(updates);
          return;
        }

        sendDragMutationsThrottled([{ id: elId, x, y }]);
      });

      shape.on("dragend", (e: any) => {
        const userId = collaborators.find(c => c.id)?.id || "";
        // Unlock node
        sendMutation("element-update", { element: { id: elId, lockedBy: null } });
        if (dragSyncRef.current.timer) {
          clearTimeout(dragSyncRef.current.timer);
          dragSyncRef.current.timer = null;
        }
        dragSyncRef.current.pending = null;

        const x = e.target.x();
        const y = e.target.y();

        const isGroupDrag =
          groupDragRef.current.anchorId === elId &&
          groupDragRef.current.anchorStart &&
          groupDragRef.current.startPositions.size > 1;

        if (isGroupDrag) {
          const anchorStart = groupDragRef.current.anchorStart!;
          const dx = x - anchorStart.x;
          const dy = y - anchorStart.y;

          groupDragRef.current.startPositions.forEach((startPos, id) => {
            const next = { x: startPos.x + dx, y: startPos.y + dy };
            dispatch({ type: "UPDATE_ELEMENT", id, updates: next });
            sendMutation("element-update", { element: { id, ...next } });
          });

          groupDragRef.current.anchorId = null;
          groupDragRef.current.anchorStart = null;
          groupDragRef.current.startPositions.clear();
          return;
        }

        dispatch({ type: "UPDATE_ELEMENT", id: elId, updates: { x, y } });
        sendMutation("element-update", { element: { id: elId, x, y } });
      });

      shape.on("transformend", () => {
        const node = shape;
        pushHistory(stateRef.current.elements);
        const updates: Partial<CanvasElement> = {
          x: node.x(),
          y: node.y(),
          rotation: node.rotation(),
          scaleX: node.scaleX(),
          scaleY: node.scaleY(),
        };
        // For resizable shapes, compute new width/height
        if (node.width && node.height) {
          updates.width = node.width() * node.scaleX();
          updates.height = node.height() * node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
        }
        if (node.radius) {
          updates.radius = node.radius() * Math.max(node.scaleX(), node.scaleY());
          node.scaleX(1);
          node.scaleY(1);
        }
        dispatch({ type: "UPDATE_ELEMENT", id: elId, updates });
        sendMutation("element-update", { element: { id: elId, ...updates } });
      });

      shape.on("dblclick dbltap", () => {
        const el = stateRef.current.elements.find((e: CanvasElement) => e.id === elId);
        if (!el || el.type !== "text") return;

        const stage = stageObjRef.current;
        if (!stage) return;
        const textNode = shape;
        const textPos = textNode.absolutePosition();
        const stageBox = stage.container().getBoundingClientRect();
        const zoom = stateRef.current.zoom;

        const textarea = document.createElement("textarea");
        document.body.appendChild(textarea);

        textarea.value = el.text || "";
        textarea.style.position = "absolute";
        textarea.style.top = `${stageBox.top + textPos.y}px`;
        textarea.style.left = `${stageBox.left + textPos.x}px`;
        textarea.style.width = `${(el.width || 250) * zoom}px`;
        textarea.style.fontSize = `${(el.fontSize || 24) * zoom}px`;
        textarea.style.fontFamily = el.fontFamily || "Arial";
        textarea.style.border = "2px solid #0ea5e9";
        textarea.style.borderRadius = "4px";
        textarea.style.padding = "8px";
        textarea.style.margin = "0px";
        textarea.style.overflow = "hidden";
        textarea.style.background = "white";
        textarea.style.outline = "none";
        textarea.style.resize = "none";
        textarea.style.lineHeight = "1.2";
        textarea.style.color = el.fill || "#0f172a";
        textarea.style.zIndex = "1000";
        textarea.focus();

        let isClosed = false;

        const cleanupTextarea = () => {
          textarea.removeEventListener("blur", handleBlur);
          textarea.removeEventListener("keydown", handleKeyDown);
          if (textarea.isConnected) {
            textarea.remove();
          }
        };

        const handleBlur = () => {
          if (isClosed) return;
          isClosed = true;
          const newText = textarea.value;
          pushHistory(stateRef.current.elements);
          dispatch({ type: "UPDATE_ELEMENT", id: elId, updates: { text: newText } });
          sendMutation("element-update", { element: { id: elId, text: newText } });
          cleanupTextarea();
        };

        const handleKeyDown = (ev: KeyboardEvent) => {
          if (ev.key === "Escape" || (ev.key === "Enter" && !ev.shiftKey)) {
            textarea.blur();
          }
        };

        textarea.addEventListener("blur", handleBlur);
        textarea.addEventListener("keydown", handleKeyDown);
      });
    },
    [dispatch, onSelectionChange, pushHistory, sendDragMutationsThrottled, sendMutation]
  );

  // Sync elements to Konva shapes
  useEffect(() => {
    if (!ready || !mainLayerRef.current || !Konva) return;

    const layer = mainLayerRef.current;
    const existingIds = new Set(shapeMapRef.current.keys());
    const newIds = new Set(state.elements.map((e) => e.id));

    // Remove deleted shapes
    existingIds.forEach((id) => {
      if (!newIds.has(id)) {
        const shape = shapeMapRef.current.get(id);
        if (shape) {
          shape.destroy();
          shapeMapRef.current.delete(id);
        }
      }
    });

    // Sort by zIndex
    const sorted = [...state.elements]
      .filter((e) => e.visible)
      .sort((a, b) => a.zIndex - b.zIndex);

    sorted.forEach((el, i) => {
      let shape = shapeMapRef.current.get(el.id);
      const userId = collaborators.find(c => c.id)?.id || "";
      if (!shape) {
        // Create new shape
        shape = createShape(el);
        if (shape) {
          layer.add(shape);
          shapeMapRef.current.set(el.id, shape);
          attachShapeEvents(shape, el.id);
        }
      } else {
        // Update existing shape properties
        const isDragging = typeof shape.isDragging === "function" && shape.isDragging();
        shape.setAttrs({
          x: isDragging ? shape.x() : el.x,
          y: isDragging ? shape.y() : el.y,
          rotation: el.rotation || 0,
          scaleX: el.scaleX || 1,
          scaleY: el.scaleY || 1,
          opacity: el.opacity ?? 1,
          draggable: el.draggable && (!el.lockedBy || el.lockedBy === userId),
          visible: el.visible,
        });

        // Type-specific updates
        if (el.type === "rect" || el.type === "image") {
          shape.setAttrs({
            width: el.width || 150,
            height: el.height || 100,
            fill: el.fill,
            stroke: el.stroke,
            strokeWidth: el.strokeWidth,
          });
        } else if (el.type === "circle") {
          shape.setAttrs({
            radius: el.radius || 60,
            fill: el.fill,
            stroke: el.stroke,
            strokeWidth: el.strokeWidth,
          });
        } else if (el.type === "ellipse") {
          shape.setAttrs({
            radiusX: el.radiusX || 80,
            radiusY: el.radiusY || 50,
            fill: el.fill,
            stroke: el.stroke,
            strokeWidth: el.strokeWidth,
          });
        } else if (el.type === "line" || el.type === "freedraw") {
          shape.setAttrs({
            points: el.points || [],
            stroke: el.stroke || "#0f172a",
            strokeWidth: el.strokeWidth || 3,
          });
        } else if (el.type === "arrow") {
          shape.setAttrs({
            points: el.points || [0, 0, 200, 0],
            stroke: el.stroke || "#1e40af",
            strokeWidth: el.strokeWidth || 3,
            fill: el.stroke || "#1e40af",
          });
        } else if (el.type === "text") {
          shape.setAttrs({
            text: el.text || "Text",
            fontSize: el.fontSize || 24,
            fontFamily: el.fontFamily || "Arial",
            fontStyle: el.fontStyle || "normal",
            textDecoration: el.textDecoration || "",
            fill: el.fill || "#0f172a",
            width: el.width || 250,
            align: el.align || "left",
          });
        }
      }

      // Ensure correct z-order
      if (shape) {
        shape.setZIndex(Math.min(i, layer.children.length - 1));
      }
    });

    // Hide invisible elements
    state.elements.forEach((el) => {
      if (!el.visible) {
        const shape = shapeMapRef.current.get(el.id);
        if (shape) shape.visible(false);
      }
    });

    // Move transformer to top
    if (transformerRef.current) {
      transformerRef.current.moveToTop();
    }

    layer.batchDraw();
  }, [state.elements, ready, createShape, attachShapeEvents]);

  // Sync transformer selection
  useEffect(() => {
    if (!ready || !transformerRef.current || !mainLayerRef.current) return;

    const nodes = state.selectedIds
      .map((id) => shapeMapRef.current.get(id))
      .filter(Boolean);

    transformerRef.current.nodes(nodes);
    mainLayerRef.current.batchDraw();
  }, [state.selectedIds, ready, state.elements]);

  // Sync zoom and pan
  useEffect(() => {
    const stage = stageObjRef.current;
    if (!stage) return;
    stage.scaleX(state.zoom);
    stage.scaleY(state.zoom);
    stage.x(state.panX);
    stage.y(state.panY);
    stage.batchDraw();
  }, [state.zoom, state.panX, state.panY]);

  // Sync collaborator cursors
  useEffect(() => {
    if (!ready || !cursorLayerRef.current || !Konva) return;
    const KonvaLib = Konva;

    const layer = cursorLayerRef.current;
    const currentCollabIds = new Set(collaborators.map((c) => c.id));

    // Remove cursors for users who left
    cursorMapRef.current.forEach((group, id) => {
      if (!currentCollabIds.has(id)) {
        group.destroy();
        cursorMapRef.current.delete(id);
      }
    });

    collaborators.forEach((collab) => {
      if (!collab.cursor) {
        const existing = cursorMapRef.current.get(collab.id);
        if (existing) existing.visible(false);
        return;
      }

      let group = cursorMapRef.current.get(collab.id);

      if (!group) {
        group = new KonvaLib.Group({
          x: collab.cursor.x,
          y: collab.cursor.y,
          listening: false,
        });

        // Cursor arrow
        group.add(
          new KonvaLib.Path({
            data: "M0 0 L0 16 L4.5 12.5 L8 20 L11 18.5 L7.5 11 L13 11 Z",
            fill: collab.color,
            stroke: "#ffffff",
            strokeWidth: 1,
            scaleX: 1.2,
            scaleY: 1.2,
          })
        );

        // Label background
        const labelWidth = collab.name.length * 8 + 16;
        group.add(
          new KonvaLib.Rect({
            x: 16,
            y: 18,
            width: labelWidth,
            height: 22,
            fill: collab.color,
            cornerRadius: 4,
          })
        );

        // Label text
        group.add(
          new KonvaLib.Text({
            x: 20,
            y: 19,
            text: collab.name,
            fontSize: 12,
            fontFamily: "system-ui, sans-serif",
            fill: "#ffffff",
            padding: 4,
          })
        );

        layer.add(group);
        cursorMapRef.current.set(collab.id, group);
      } else {
        group.visible(true);
        group.x(collab.cursor.x);
        group.y(collab.cursor.y);
      }
    });

    // Show collab selection highlights
    collaborators.forEach((collab) => {
      if (collab.selectedElementId) {
        const shape = shapeMapRef.current.get(collab.selectedElementId);
        if (shape) {
          shape.setAttrs({
            shadowColor: collab.color,
            shadowBlur: 10,
            shadowOpacity: 0.6,
          });
        }
      }
    });

    layer.batchDraw();
    mainLayerRef.current?.batchDraw();
  }, [collaborators, ready]);

  // Stage event handlers
  useEffect(() => {
    const stage = stageObjRef.current;
    if (!stage || !ready) return;

    const handleMouseDown = (e: any) => {
      const st = stateRef.current;
      const pos = getPointerPosition();
      if (!pos) return;

      // Middle mouse or hand tool for panning
      if (e.evt.button === 1 || st.tool === "hand") {
        isPanningRef.current = true;
        lastPanPosRef.current = { x: e.evt.clientX, y: e.evt.clientY };
        return;
      }

      // Click on background with select tool -> deselect
      if (e.target === stage && st.tool === "select") {
        dispatch({ type: "SELECT_ELEMENTS", ids: [] });
        onSelectionChange(null);
        return;
      }

      // Creation tools
      if (st.tool !== "select" && st.tool !== "image") {
        pushHistory(st.elements);
        isDrawingRef.current = true;

        if (st.tool === "freedraw") {
          const el = createDefaultElement("freedraw", pos.x, pos.y, {
            points: [0, 0],
            stroke: st.strokeColor,
            strokeWidth: st.strokeWidth,
          });
          currentDrawIdRef.current = el.id;
          dispatch({ type: "ADD_ELEMENT", element: el });
          sendMutation("element-add", { element: el });
        } else if (st.tool === "text") {
          const el = createDefaultElement("text", pos.x, pos.y, {
            fill: st.fillColor,
            fontSize: st.fontSize,
            fontFamily: st.fontFamily,
          });
          dispatch({ type: "ADD_ELEMENT", element: el });
          sendMutation("element-add", { element: el });
          dispatch({ type: "SELECT_ELEMENTS", ids: [el.id] });
          dispatch({ type: "SET_TOOL", tool: "select" });
          isDrawingRef.current = false;
        } else if (st.tool === "line" || st.tool === "arrow") {
          const el = createDefaultElement(st.tool, pos.x, pos.y, {
            points: [0, 0, 0, 0],
            stroke: st.strokeColor,
            strokeWidth: st.strokeWidth,
          });
          currentDrawIdRef.current = el.id;
          dispatch({ type: "ADD_ELEMENT", element: el });
          sendMutation("element-add", { element: el });
        } else {
          const el = createDefaultElement(st.tool, pos.x, pos.y, {
            width: 0,
            height: 0,
            radius: 0,
            radiusX: 0,
            radiusY: 0,
            fill: st.fillColor,
            stroke: st.strokeColor,
            strokeWidth: st.strokeWidth,
          });
          currentDrawIdRef.current = el.id;
          dispatch({ type: "ADD_ELEMENT", element: el });
          sendMutation("element-add", { element: el });
        }
      }
    };

    const handleMouseMove = (e: any) => {
      const st = stateRef.current;
      const pos = getPointerPosition();
      if (pos) onCursorMove(pos.x, pos.y);

      if (isPanningRef.current) {
        const dx = e.evt.clientX - lastPanPosRef.current.x;
        const dy = e.evt.clientY - lastPanPosRef.current.y;
        lastPanPosRef.current = { x: e.evt.clientX, y: e.evt.clientY };
        dispatch({ type: "SET_PAN", panX: st.panX + dx, panY: st.panY + dy });
        return;
      }

      if (!isDrawingRef.current || !currentDrawIdRef.current || !pos) return;

      const el = st.elements.find((e: CanvasElement) => e.id === currentDrawIdRef.current);
      if (!el) return;

      if (st.tool === "freedraw") {
        const newPoints = [...(el.points || []), pos.x - el.x, pos.y - el.y];
        dispatch({ type: "UPDATE_ELEMENT", id: el.id, updates: { points: newPoints } });
      } else if (st.tool === "line" || st.tool === "arrow") {
        dispatch({
          type: "UPDATE_ELEMENT",
          id: el.id,
          updates: { points: [0, 0, pos.x - el.x, pos.y - el.y] },
        });
      } else if (st.tool === "circle") {
        const dx = pos.x - el.x;
        const dy = pos.y - el.y;
        dispatch({
          type: "UPDATE_ELEMENT",
          id: el.id,
          updates: { radius: Math.sqrt(dx * dx + dy * dy) },
        });
      } else if (st.tool === "ellipse") {
        dispatch({
          type: "UPDATE_ELEMENT",
          id: el.id,
          updates: { radiusX: Math.abs(pos.x - el.x), radiusY: Math.abs(pos.y - el.y) },
        });
      } else {
        dispatch({
          type: "UPDATE_ELEMENT",
          id: el.id,
          updates: { width: pos.x - el.x, height: pos.y - el.y },
        });
      }
    };

    const handleDragMove = () => {
      const pos = getPointerPosition();
      if (!pos) return;
      onCursorMove(pos.x, pos.y);
    };

    const handleMouseUp = () => {
      isPanningRef.current = false;
      const st = stateRef.current;

      if (isDrawingRef.current && currentDrawIdRef.current) {
        const el = st.elements.find(
          (e: CanvasElement) => e.id === currentDrawIdRef.current
        );
        if (el) {
          sendMutation("element-update", { element: el });
          dispatch({ type: "SELECT_ELEMENTS", ids: [el.id] });
        }
        if (st.tool !== "freedraw") {
          dispatch({ type: "SET_TOOL", tool: "select" });
        }
      }

      isDrawingRef.current = false;
      currentDrawIdRef.current = null;
    };

    const handleWheel = (e: any) => {
      e.evt.preventDefault();
      const st = stateRef.current;

      if (e.evt.ctrlKey || e.evt.metaKey) {
        const scaleBy = 1.05;
        const newZoom = e.evt.deltaY < 0 ? st.zoom * scaleBy : st.zoom / scaleBy;
        dispatch({ type: "SET_ZOOM", zoom: Math.max(0.1, Math.min(5, newZoom)) });
      } else {
        dispatch({
          type: "SET_PAN",
          panX: st.panX - e.evt.deltaX,
          panY: st.panY - e.evt.deltaY,
        });
      }
    };

    const handleContextMenu = (e: any) => e.evt.preventDefault();

    stage.on("mousedown touchstart", handleMouseDown);
    stage.on("mousemove touchmove", handleMouseMove);
    stage.on("dragmove", handleDragMove);
    stage.on("mouseup touchend", handleMouseUp);
    stage.on("wheel", handleWheel);
    stage.on("contextmenu", handleContextMenu);

    return () => {
      stage.off("mousedown touchstart", handleMouseDown);
      stage.off("mousemove touchmove", handleMouseMove);
      stage.off("dragmove", handleDragMove);
      stage.off("mouseup touchend", handleMouseUp);
      stage.off("wheel", handleWheel);
      stage.off("contextmenu", handleContextMenu);
    };
  }, [
    ready,
    dispatch,
    getPointerPosition,
    onCursorMove,
    onSelectionChange,
    pushHistory,
    sendMutation,
  ]);

  // Dynamic cursor style
  const cursorStyle =
    state.tool === "hand"
      ? "grab"
      : state.tool === "select"
        ? "default"
        : "crosshair";

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-muted/30"
      style={{ cursor: cursorStyle }}
    >
      <div ref={containerRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading canvas...</p>
          </div>
        </div>
      )}
    </div>
  );
}
