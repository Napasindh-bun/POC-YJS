"use client";

import { Button } from "@/components/ui/button";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { Minus, Plus, Maximize2 } from "lucide-react";

export default function ZoomControls() {
  const { state, dispatch } = useCanvasStore();

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-card border border-border rounded-lg shadow-lg px-2 py-1">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() =>
          dispatch({
            type: "SET_ZOOM",
            zoom: Math.max(0.1, state.zoom - 0.1),
          })
        }
      >
        <Minus className="w-3.5 h-3.5" />
        <span className="sr-only">Zoom out</span>
      </Button>

      <button
        onClick={() => {
          dispatch({ type: "SET_ZOOM", zoom: 1 });
          dispatch({ type: "SET_PAN", panX: 0, panY: 0 });
        }}
        className="text-xs font-medium text-foreground tabular-nums min-w-[3.5rem] text-center hover:bg-accent rounded px-1.5 py-1 transition-colors"
      >
        {Math.round(state.zoom * 100)}%
      </button>

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() =>
          dispatch({
            type: "SET_ZOOM",
            zoom: Math.min(5, state.zoom + 0.1),
          })
        }
      >
        <Plus className="w-3.5 h-3.5" />
        <span className="sr-only">Zoom in</span>
      </Button>

      <div className="w-px h-5 bg-border mx-0.5" />

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          dispatch({ type: "SET_ZOOM", zoom: 1 });
          dispatch({ type: "SET_PAN", panX: 0, panY: 0 });
        }}
        title="Fit to screen"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span className="sr-only">Fit to screen</span>
      </Button>
    </div>
  );
}
