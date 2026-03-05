"use client";

import { useRef, useCallback, useMemo } from "react";
import { CanvasContext, useCanvasReducer } from "@/hooks/useCanvasStore";
import { useCollaboration } from "@/hooks/useCollaboration";
import { useHistory } from "@/hooks/useHistory";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import TopToolbar from "@/components/toolbar/TopToolbar";
import ToolSidebar from "@/components/toolbar/ToolSidebar";
import PropertiesPanel from "@/components/toolbar/PropertiesPanel";
import ZoomControls from "@/components/toolbar/ZoomControls";
import CanvasEditor from "@/components/canvas/CanvasEditor";
import { createDefaultElement } from "@/lib/types";
import { getRandomName } from "@/lib/colors";

interface EditorWorkspaceProps {
  roomId: string;
}

export default function EditorWorkspace({ roomId }: EditorWorkspaceProps) {
  const [state, dispatch] = useCanvasReducer();
  const stageRef = useRef<any>(null);

  // Generate stable user identity
  const userRef = useRef({
    id: typeof window !== "undefined" ? crypto.randomUUID() : "anon",
    name: typeof window !== "undefined" ? getRandomName() : "Anon",
  });

  // History
  const { pushHistory, undo, redo, canUndo, canRedo } = useHistory();

  // Collaboration
  const {
    collaborators,
    isConnected,
    sendMutation,
    sendCursorMove,
    sendSelectionChange,
  } = useCollaboration({
    roomId,
    userId: userRef.current.id,
    userName: userRef.current.name,
    dispatch,
  });

  // Undo/Redo handlers
  const handleUndo = useCallback(() => {
    const prev = undo(state.elements);
    if (prev) {
      dispatch({ type: "SET_ELEMENTS", elements: prev });
      sendMutation("elements-reorder", { elements: prev });
    }
  }, [undo, state.elements, dispatch, sendMutation]);

  const handleRedo = useCallback(() => {
    const next = redo(state.elements);
    if (next) {
      dispatch({ type: "SET_ELEMENTS", elements: next });
      sendMutation("elements-reorder", { elements: next });
    }
  }, [redo, state.elements, dispatch, sendMutation]);

  // Export PNG
  const handleExportPNG = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const dataURL = stage.toDataURL({ pixelRatio: 2 });
    const link = document.createElement("a");
    link.download = "design.png";
    link.href = dataURL;
    link.click();
  }, []);

  // Export JSON
  const handleExportJSON = useCallback(() => {
    const json = JSON.stringify(state.elements, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "design.json";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, [state.elements]);

  // Import JSON
  const handleImportJSON = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const elements = JSON.parse(reader.result as string);
          if (Array.isArray(elements)) {
            pushHistory(state.elements);
            dispatch({ type: "SET_ELEMENTS", elements });
            sendMutation("elements-reorder", { elements });
          }
        } catch {
          // invalid JSON
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [state.elements, dispatch, pushHistory, sendMutation]);

  // Image upload handler
  const handleImageUpload = useCallback(
    (src: string) => {
      pushHistory(state.elements);
      const el = createDefaultElement("image", 100 + Math.random() * 200, 100 + Math.random() * 200, {
        src,
      });
      dispatch({ type: "ADD_ELEMENT", element: el });
      sendMutation("element-add", { element: el });
      dispatch({ type: "SELECT_ELEMENTS", ids: [el.id] });
      dispatch({ type: "SET_TOOL", tool: "select" });
    },
    [state.elements, dispatch, pushHistory, sendMutation]
  );

  // Keyboard shortcuts
  useKeyboardShortcuts({
    dispatch,
    state,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onExport: handleExportPNG,
    pushHistory,
    sendMutation,
  });

  const contextValue = useMemo(
    () => ({ state, dispatch }),
    [state, dispatch]
  );

  return (
    <CanvasContext.Provider value={contextValue}>
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        <TopToolbar
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onExportPNG={handleExportPNG}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          collaborators={collaborators}
          isConnected={isConnected}
          roomId={roomId}
          zoom={state.zoom}
        />

        <div className="flex flex-1 min-h-0">
          <ToolSidebar
            onImageUpload={handleImageUpload}
            sendMutation={sendMutation}
            pushHistory={pushHistory}
          />

          <div className="flex-1 relative">
            <CanvasEditor
              collaborators={collaborators}
              onCursorMove={sendCursorMove}
              onSelectionChange={sendSelectionChange}
              sendMutation={sendMutation}
              pushHistory={pushHistory}
              stageRef={stageRef}
            />
            <ZoomControls />
          </div>

          <PropertiesPanel
            sendMutation={sendMutation}
            pushHistory={pushHistory}
          />
        </div>
      </div>
    </CanvasContext.Provider>
  );
}
