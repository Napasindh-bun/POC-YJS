"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import EditorWorkspace from "@/components/EditorWorkspace";

function EditorContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get("room") || "default";

  return <EditorWorkspace roomId={roomId} />;
}

export default function EditorPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen bg-background">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">
              Loading editor...
            </p>
          </div>
        </div>
      }
    >
      <EditorContent />
    </Suspense>
  );
}
