"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import type { Collaborator } from "@/lib/types";
import {
  Undo2,
  Redo2,
  Download,
  Share2,
  FileJson,
  Upload,
  PenTool,
} from "lucide-react";

interface TopToolbarProps {
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportPNG: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  collaborators: Collaborator[];
  isConnected: boolean;
  roomId: string;
  zoom: number;
}

export default function TopToolbar({
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportPNG,
  onExportJSON,
  onImportJSON,
  collaborators,
  isConnected,
  roomId,
  zoom,
}: TopToolbarProps) {
  const [fileName, setFileName] = useState("Untitled Design");
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <header className="flex items-center h-14 border-b border-border bg-card px-4 shrink-0">
      {/* Left: Logo + File name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
            <PenTool className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold text-sm text-foreground hidden sm:inline">
            DesignFlow
          </span>
        </div>

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        {isEditing ? (
          <input
            className="text-sm font-medium bg-transparent border-b border-primary outline-none px-1 py-0.5 text-foreground max-w-40"
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") setIsEditing(false);
            }}
            autoFocus
          />
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm font-medium text-foreground hover:text-muted-foreground transition-colors truncate max-w-40"
          >
            {fileName}
          </button>
        )}
      </div>

      {/* Center: Undo/Redo */}
      <div className="flex items-center gap-1 mx-auto">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onUndo}
              disabled={!canUndo}
            >
              <Undo2 className="w-4 h-4" />
              <span className="sr-only">Undo</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{"Undo (Ctrl+Z)"}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onRedo}
              disabled={!canRedo}
            >
              <Redo2 className="w-4 h-4" />
              <span className="sr-only">Redo</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{"Redo (Ctrl+Shift+Z)"}</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6 mx-2" />

        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Right: Export, Share, Collaborators */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Connection indicator */}
        <div className="flex items-center gap-1.5 mr-2">
          <div
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-green-500" : "bg-muted-foreground"
            }`}
          />
          <span className="text-xs text-muted-foreground hidden lg:inline">
            {isConnected ? "Connected" : "Offline"}
          </span>
        </div>

        {/* Collaborator avatars */}
        {collaborators.length > 0 && (
          <div className="flex -space-x-2 mr-2">
            {collaborators.slice(0, 5).map((c) => (
              <div
                key={c.id}
                className="w-7 h-7 rounded-full border-2 border-card flex items-center justify-center text-[10px] font-semibold text-white"
                style={{ backgroundColor: c.color }}
                title={c.name}
              >
                {c.name[0]}
              </div>
            ))}
            {collaborators.length > 5 && (
              <div className="w-7 h-7 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                +{collaborators.length - 5}
              </div>
            )}
          </div>
        )}

        <Separator orientation="vertical" className="h-6 hidden sm:block" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onImportJSON}>
              <Upload className="w-4 h-4" />
              <span className="sr-only">Import JSON</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Import JSON</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onExportJSON}>
              <FileJson className="w-4 h-4" />
              <span className="sr-only">Export JSON</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Export JSON</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={onExportPNG}>
              <Download className="w-4 h-4" />
              <span className="sr-only">Export PNG</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{"Export PNG (Ctrl+S)"}</TooltipContent>
        </Tooltip>

        <Button
          variant="default"
          size="sm"
          onClick={handleShare}
          className="gap-1.5"
        >
          <Share2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">
            {copied ? "Copied!" : "Share"}
          </span>
        </Button>
      </div>
    </header>
  );
}
