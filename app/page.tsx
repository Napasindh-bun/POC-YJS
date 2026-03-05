"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  PenTool,
  Users,
  Layers,
  Download,
  ArrowRight,
  Sparkles,
  MousePointer2,
  Zap,
} from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const [roomName, setRoomName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = () => {
    const id = roomName.trim() || crypto.randomUUID().slice(0, 8);
    router.push(`/editor?room=${encodeURIComponent(id)}`);
  };

  const handleJoinRoom = () => {
    if (roomName.trim()) {
      router.push(`/editor?room=${encodeURIComponent(roomName.trim())}`);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary">
            <PenTool className="w-4.5 h-4.5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg text-foreground tracking-tight">
            DesignFlow
          </span>
        </div>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            const id = crypto.randomUUID().slice(0, 8);
            router.push(`/editor?room=${id}`);
          }}
          className="gap-1.5"
        >
          Start Designing
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium mb-6">
            <Sparkles className="w-3 h-3" />
            Real-time collaborative design editor
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-foreground tracking-tight mb-4 text-balance">
            Design together, in real time
          </h1>

          <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto leading-relaxed">
            A powerful canvas editor with shapes, text, images, free draw, and
            live collaboration. Built with Next.js and Konva.
          </p>

          {/* Create / Join */}
          <div className="flex flex-col sm:flex-row items-center gap-3 max-w-md mx-auto mb-16">
            <input
              type="text"
              placeholder="Enter room name (or leave blank)"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateRoom();
              }}
              className="flex-1 w-full h-11 px-4 text-sm rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="flex gap-2">
              <Button onClick={handleCreateRoom} className="h-11 px-6 gap-1.5">
                <Zap className="w-4 h-4" />
                New Design
              </Button>
              {roomName.trim() && (
                <Button
                  variant="outline"
                  onClick={handleJoinRoom}
                  className="h-11 px-6 gap-1.5"
                >
                  <Users className="w-4 h-4" />
                  Join Room
                </Button>
              )}
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
            <FeatureCard
              icon={<MousePointer2 className="w-5 h-5" />}
              title="Live Cursors"
              description="See collaborators' cursors and selections in real time"
            />
            <FeatureCard
              icon={<Layers className="w-5 h-5" />}
              title="Full Canvas"
              description="Shapes, text, images, free draw, layers, and transforms"
            />
            <FeatureCard
              icon={<Download className="w-5 h-5" />}
              title="Export"
              description="Export your designs as PNG or JSON with one click"
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-6 text-xs text-muted-foreground border-t border-border">
        Built with Next.js, Konva, and Server-Sent Events
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 p-5 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-secondary-foreground">
        {icon}
      </div>
      <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      <p className="text-xs text-muted-foreground text-center leading-relaxed">
        {description}
      </p>
    </div>
  );
}
