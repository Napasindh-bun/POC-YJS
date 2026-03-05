"use client";

import { useCanvasStore, useSelectedElements } from "@/hooks/useCanvasStore";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FONT_FAMILIES, createDefaultElement } from "@/lib/types";
import type { CanvasElement } from "@/lib/types";
import {
  Trash2,
  Copy,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from "lucide-react";

interface PropertiesPanelProps {
  sendMutation: (type: string, payload: Record<string, unknown>) => void;
  pushHistory: (elements: CanvasElement[]) => void;
}

export default function PropertiesPanel({
  sendMutation,
  pushHistory,
}: PropertiesPanelProps) {
  const { state, dispatch } = useCanvasStore();
  const selectedElements = useSelectedElements();

  if (selectedElements.length === 0) {
    return (
      <aside className="w-64 border-l border-border bg-card shrink-0 flex flex-col">
        <div className="p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Design
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center px-6">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Select an element on the canvas to edit its properties.
          </p>
        </div>

        {/* Default fill/stroke color pickers */}
        <div className="p-4 border-t border-border">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Default Colors
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-12">Fill</label>
              <input
                type="color"
                value={state.fillColor}
                onChange={(e) =>
                  dispatch({ type: "SET_FILL_COLOR", color: e.target.value })
                }
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <span className="text-xs font-mono text-muted-foreground">
                {state.fillColor}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground w-12">Stroke</label>
              <input
                type="color"
                value={state.strokeColor}
                onChange={(e) =>
                  dispatch({
                    type: "SET_STROKE_COLOR",
                    color: e.target.value,
                  })
                }
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <span className="text-xs font-mono text-muted-foreground">
                {state.strokeColor}
              </span>
            </div>
          </div>
        </div>
      </aside>
    );
  }

  const el = selectedElements[0];
  const multi = selectedElements.length > 1;

  const updateProp = (updates: Partial<CanvasElement>) => {
    pushHistory(state.elements);
    selectedElements.forEach((sel) => {
      dispatch({ type: "UPDATE_ELEMENT", id: sel.id, updates });
      sendMutation("element-update", {
        element: { id: sel.id, ...updates },
      });
    });
  };

  const handleDuplicate = () => {
    pushHistory(state.elements);
    const newIds: string[] = [];
    selectedElements.forEach((sel) => {
      const dup = {
        ...sel,
        id: crypto.randomUUID(),
        x: sel.x + 20,
        y: sel.y + 20,
        name: sel.name + " copy",
        zIndex: Date.now(),
      };
      newIds.push(dup.id);
      dispatch({ type: "ADD_ELEMENT", element: dup });
      sendMutation("element-add", { element: dup });
    });
    dispatch({ type: "SELECT_ELEMENTS", ids: newIds });
  };

  const handleDelete = () => {
    pushHistory(state.elements);
    const ids = selectedElements.map((e) => e.id);
    ids.forEach((id) => {
      sendMutation("element-delete", { elementId: id });
    });
    dispatch({ type: "DELETE_ELEMENTS", ids });
  };

  return (
    <aside className="w-64 border-l border-border bg-card shrink-0 flex flex-col overflow-hidden">
      <ScrollArea className="flex-1">
        <div className="p-4">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            {multi ? `${selectedElements.length} Elements` : el.type.charAt(0).toUpperCase() + el.type.slice(1)}
          </p>
          {!multi && (
            <p className="text-xs text-muted-foreground mb-3">{el.name}</p>
          )}

          {/* Position & Size */}
          {!multi && (
            <>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">X</label>
                  <input
                    type="number"
                    value={Math.round(el.x)}
                    onChange={(e) =>
                      updateProp({ x: Number(e.target.value) })
                    }
                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">Y</label>
                  <input
                    type="number"
                    value={Math.round(el.y)}
                    onChange={(e) =>
                      updateProp({ y: Number(e.target.value) })
                    }
                    className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                  />
                </div>
                {(el.width !== undefined || el.type === "rect" || el.type === "text" || el.type === "image") && (
                  <>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">W</label>
                      <input
                        type="number"
                        value={Math.round(el.width || 0)}
                        onChange={(e) =>
                          updateProp({ width: Number(e.target.value) })
                        }
                        className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground uppercase">H</label>
                      <input
                        type="number"
                        value={Math.round(el.height || 0)}
                        onChange={(e) =>
                          updateProp({ height: Number(e.target.value) })
                        }
                        className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                      />
                    </div>
                  </>
                )}
                {el.type === "circle" && (
                  <div className="col-span-2">
                    <label className="text-[10px] text-muted-foreground uppercase">
                      Radius
                    </label>
                    <input
                      type="number"
                      value={Math.round(el.radius || 0)}
                      onChange={(e) =>
                        updateProp({ radius: Number(e.target.value) })
                      }
                      className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                    />
                  </div>
                )}
              </div>

              <div className="mb-3">
                <label className="text-[10px] text-muted-foreground uppercase">
                  Rotation
                </label>
                <input
                  type="number"
                  value={Math.round(el.rotation || 0)}
                  onChange={(e) =>
                    updateProp({ rotation: Number(e.target.value) })
                  }
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                />
              </div>

              <Separator className="my-3" />
            </>
          )}

          {/* Fill & Stroke */}
          <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">
            Appearance
          </p>
          <div className="flex flex-col gap-3 mb-3">
            {el.type !== "line" && el.type !== "arrow" && el.type !== "freedraw" && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground w-12">Fill</label>
                <input
                  type="color"
                  value={el.fill || "#3b82f6"}
                  onChange={(e) => updateProp({ fill: e.target.value })}
                  className="w-8 h-8 rounded border border-border cursor-pointer"
                />
                <span className="text-xs font-mono text-muted-foreground">
                  {el.fill || "#3b82f6"}
                </span>
              </div>
            )}
            {el.type !== "text" && el.type !== "image" && (
              <>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-muted-foreground w-12">Stroke</label>
                  <input
                    type="color"
                    value={el.stroke || "#1e40af"}
                    onChange={(e) => updateProp({ stroke: e.target.value })}
                    className="w-8 h-8 rounded border border-border cursor-pointer"
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    {el.stroke || "#1e40af"}
                  </span>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground uppercase">
                    Stroke Width
                  </label>
                  <Slider
                    value={[el.strokeWidth || 2]}
                    min={0}
                    max={20}
                    step={1}
                    onValueChange={([val]) => updateProp({ strokeWidth: val })}
                    className="mt-1"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {el.strokeWidth || 2}px
                  </span>
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] text-muted-foreground uppercase">
                Opacity
              </label>
              <Slider
                value={[(el.opacity ?? 1) * 100]}
                min={0}
                max={100}
                step={1}
                onValueChange={([val]) =>
                  updateProp({ opacity: val / 100 })
                }
                className="mt-1"
              />
              <span className="text-[10px] text-muted-foreground">
                {Math.round((el.opacity ?? 1) * 100)}%
              </span>
            </div>
          </div>

          {/* Text Properties */}
          {el.type === "text" && !multi && (
            <>
              <Separator className="my-3" />
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">
                Text
              </p>
              <div className="flex flex-col gap-2">
                <select
                  value={el.fontFamily || "Arial"}
                  onChange={(e) =>
                    updateProp({ fontFamily: e.target.value })
                  }
                  className="w-full h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                >
                  {FONT_FAMILIES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={el.fontSize || 24}
                    onChange={(e) =>
                      updateProp({ fontSize: Number(e.target.value) })
                    }
                    className="w-16 h-8 px-2 text-xs rounded-md border border-input bg-background text-foreground"
                    min={8}
                    max={200}
                  />
                  <Button
                    variant={
                      el.fontStyle?.includes("bold") ? "default" : "ghost"
                    }
                    size="icon-sm"
                    onClick={() =>
                      updateProp({
                        fontStyle: el.fontStyle?.includes("bold")
                          ? el.fontStyle.replace("bold", "").trim() || "normal"
                          : `bold ${el.fontStyle || ""}`.trim(),
                      })
                    }
                  >
                    <Bold className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={
                      el.fontStyle?.includes("italic") ? "default" : "ghost"
                    }
                    size="icon-sm"
                    onClick={() =>
                      updateProp({
                        fontStyle: el.fontStyle?.includes("italic")
                          ? el.fontStyle.replace("italic", "").trim() || "normal"
                          : `${el.fontStyle || ""} italic`.trim(),
                      })
                    }
                  >
                    <Italic className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={el.textDecoration === "underline" ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() =>
                      updateProp({
                        textDecoration:
                          el.textDecoration === "underline" ? "" : "underline",
                      })
                    }
                  >
                    <Underline className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant={el.align === "left" || !el.align ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() => updateProp({ align: "left" })}
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={el.align === "center" ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() => updateProp({ align: "center" })}
                  >
                    <AlignCenter className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant={el.align === "right" ? "default" : "ghost"}
                    size="icon-sm"
                    onClick={() => updateProp({ align: "right" })}
                  >
                    <AlignRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </>
          )}

          <Separator className="my-3" />

          {/* Layer Order */}
          {!multi && (
            <>
              <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-2">
                Layer Order
              </p>
              <div className="flex items-center gap-1 mb-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    dispatch({
                      type: "REORDER_ELEMENT",
                      id: el.id,
                      direction: "top",
                    })
                  }
                  title="Bring to front"
                >
                  <ChevronsUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    dispatch({
                      type: "REORDER_ELEMENT",
                      id: el.id,
                      direction: "up",
                    })
                  }
                  title="Bring forward"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    dispatch({
                      type: "REORDER_ELEMENT",
                      id: el.id,
                      direction: "down",
                    })
                  }
                  title="Send backward"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() =>
                    dispatch({
                      type: "REORDER_ELEMENT",
                      id: el.id,
                      direction: "bottom",
                    })
                  }
                  title="Send to back"
                >
                  <ChevronsDown className="w-3.5 h-3.5" />
                </Button>
              </div>
              <Separator className="my-3" />
            </>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5"
              onClick={handleDuplicate}
            >
              <Copy className="w-3.5 h-3.5" />
              Duplicate
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </Button>
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}
