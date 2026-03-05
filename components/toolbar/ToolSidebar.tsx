"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import type { ToolType, CanvasElement } from "@/lib/types";
import { createDefaultElement } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  MousePointer2,
  Square,
  Circle,
  Minus,
  MoveRight,
  Type,
  Pencil,
  ImageIcon,
  Hand,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  Layers,
  Trash2,
} from "lucide-react";

const tools: {
  type: ToolType;
  icon: React.ElementType;
  label: string;
  shortcut: string;
}[] = [
  { type: "select", icon: MousePointer2, label: "Select", shortcut: "V" },
  { type: "hand", icon: Hand, label: "Hand (Pan)", shortcut: "H" },
  { type: "rect", icon: Square, label: "Rectangle", shortcut: "R" },
  { type: "circle", icon: Circle, label: "Circle", shortcut: "O" },
  { type: "line", icon: Minus, label: "Line", shortcut: "L" },
  { type: "arrow", icon: MoveRight, label: "Arrow", shortcut: "A" },
  { type: "text", icon: Type, label: "Text", shortcut: "T" },
  { type: "freedraw", icon: Pencil, label: "Pencil", shortcut: "P" },
  { type: "image", icon: ImageIcon, label: "Image", shortcut: "" },
];

interface ToolSidebarProps {
  onImageUpload: (src: string) => void;
  sendMutation: (type: string, payload: Record<string, unknown>) => void;
  pushHistory: (elements: CanvasElement[]) => void;
}

export default function ToolSidebar({
  onImageUpload,
  sendMutation,
  pushHistory,
}: ToolSidebarProps) {
  const { state, dispatch } = useCanvasStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleToolClick = (tool: ToolType) => {
    if (tool === "image") {
      fileInputRef.current?.click();
      return;
    }
    dispatch({ type: "SET_TOOL", tool });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      onImageUpload(src);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const sortedElements = [...state.elements].sort(
    (a, b) => b.zIndex - a.zIndex
  );

  return (
    <aside className="flex flex-col w-60 border-r border-border bg-card shrink-0 overflow-hidden">
      {/* Tools section */}
      <div className="p-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Tools
        </p>
        <div className="grid grid-cols-3 gap-1">
          {tools.map(({ type, icon: Icon, label, shortcut }) => (
            <Tooltip key={type}>
              <TooltipTrigger asChild>
                <Button
                  variant={state.tool === type ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "flex flex-col gap-0.5 h-auto py-2 px-1",
                    state.tool === type && "shadow-sm"
                  )}
                  onClick={() => handleToolClick(type)}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] leading-none">{label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {label}
                {shortcut ? ` (${shortcut})` : ""}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageChange}
        className="hidden"
      />

      <Separator />

      {/* Quick shapes */}
      <div className="p-3">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Quick Add
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: "Blue Rect", fill: "#3b82f6", type: "rect" as const },
            { label: "Red Circle", fill: "#ef4444", type: "circle" as const },
            { label: "Green Rect", fill: "#22c55e", type: "rect" as const },
            { label: "Orange Rect", fill: "#f97316", type: "rect" as const },
          ].map((shape, i) => (
            <button
              key={i}
              className="h-10 rounded-md border border-border hover:border-primary/50 transition-colors"
              style={{ backgroundColor: shape.fill }}
              onClick={() => {
                pushHistory(state.elements);
                const el = createDefaultElement(
                  shape.type,
                  100 + Math.random() * 200,
                  100 + Math.random() * 200,
                  { fill: shape.fill }
                );
                dispatch({ type: "ADD_ELEMENT", element: el });
                sendMutation("element-add", { element: el });
                dispatch({ type: "SELECT_ELEMENTS", ids: [el.id] });
                dispatch({ type: "SET_TOOL", tool: "select" });
              }}
              title={shape.label}
            />
          ))}
        </div>
      </div>

      <Separator />

      {/* Layers section */}
      <div className="flex flex-col flex-1 min-h-0 p-3">
        <div className="flex items-center gap-1.5 mb-2">
          <Layers className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            Layers ({sortedElements.length})
          </p>
        </div>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-0.5 pr-2">
            {sortedElements.map((el) => {
              const isSelected = state.selectedIds.includes(el.id);
              return (
                <div
                  key={el.id}
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs cursor-pointer transition-colors group",
                    isSelected
                      ? "bg-primary/10 text-foreground"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => {
                    dispatch({
                      type: "SELECT_ELEMENTS",
                      ids: [el.id],
                    });
                  }}
                >
                  {/* Type icon */}
                  <span className="shrink-0 opacity-60">
                    {el.type === "rect" && <Square className="w-3 h-3" />}
                    {el.type === "circle" && <Circle className="w-3 h-3" />}
                    {el.type === "text" && <Type className="w-3 h-3" />}
                    {el.type === "line" && <Minus className="w-3 h-3" />}
                    {el.type === "arrow" && <MoveRight className="w-3 h-3" />}
                    {el.type === "freedraw" && <Pencil className="w-3 h-3" />}
                    {el.type === "image" && <ImageIcon className="w-3 h-3" />}
                    {el.type === "ellipse" && <Circle className="w-3 h-3" />}
                  </span>

                  {/* Name */}
                  <span className="truncate flex-1">{el.name}</span>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({
                          type: "TOGGLE_ELEMENT_VISIBILITY",
                          id: el.id,
                        });
                      }}
                      className="p-0.5 hover:bg-background rounded"
                    >
                      {el.visible ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <EyeOff className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch({
                          type: "TOGGLE_ELEMENT_LOCK",
                          id: el.id,
                        });
                      }}
                      className="p-0.5 hover:bg-background rounded"
                    >
                      {el.locked ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <Unlock className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        pushHistory(state.elements);
                        sendMutation("element-delete", {
                          elementId: el.id,
                        });
                        dispatch({
                          type: "DELETE_ELEMENTS",
                          ids: [el.id],
                        });
                      }}
                      className="p-0.5 hover:bg-destructive/10 hover:text-destructive rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}

            {sortedElements.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">
                No elements yet. Use the tools above to add shapes, text, or images.
              </p>
            )}
          </div>
        </ScrollArea>
      </div>
    </aside>
  );
}
