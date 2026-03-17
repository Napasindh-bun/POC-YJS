"use client";

import { useEffect, useCallback, useState } from "react";
import * as Y from "yjs";

interface DraftInfo {
  timestamp: number;
  roomId: string;
  age: number;
  sizeKB: number;
}

interface LocalPersistenceOptions {
  roomId: string;
  ydoc: Y.Doc | null;
  enabled?: boolean;
  autoSaveInterval?: number; // milliseconds
  maxAge?: number; // milliseconds
}

const STORAGE_PREFIX = "yjs-draft-";
const DEFAULT_AUTO_SAVE_INTERVAL = 10000; // 10 seconds
const DEFAULT_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

export function useLocalPersistence({
  roomId,
  ydoc,
  enabled = true,
  autoSaveInterval = DEFAULT_AUTO_SAVE_INTERVAL,
  maxAge = DEFAULT_MAX_AGE,
}: LocalPersistenceOptions) {
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const storageKey = `${STORAGE_PREFIX}${roomId}`;

  /**
   * บันทึก Yjs state ลง localStorage
   */
  const saveToLocal = useCallback(() => {
    if (!enabled || !ydoc || typeof window === "undefined") return;

    try {
      const state = Y.encodeStateAsUpdate(ydoc);
      const stateArray = Array.from(state);
      const timestamp = Date.now();

      const data = {
        state: stateArray,
        timestamp,
        roomId,
        version: 1,
      };

      localStorage.setItem(storageKey, JSON.stringify(data));
      setLastSaved(timestamp);

      console.log(`💾 Saved to localStorage:`, {
        room: roomId,
        size: `${(stateArray.length / 1024).toFixed(2)} KB`,
        elements: ydoc.getMap("elements").size,
        timestamp: new Date(timestamp).toLocaleTimeString(),
      });
    } catch (error) {
      if (error instanceof Error && error.name === "QuotaExceededError") {
        console.error("❌ localStorage quota exceeded. Clearing old data...");
        clearLocal();
      } else {
        console.error("❌ Failed to save to localStorage:", error);
      }
    }
  }, [enabled, ydoc, roomId, storageKey]);

  /**
   * โหลด Yjs state จาก localStorage
   */
  const loadFromLocal = useCallback((): boolean => {
    if (!enabled || !ydoc || typeof window === "undefined") return false;

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) {
        console.log("📭 No localStorage draft found");
        return false;
      }

      const data = JSON.parse(saved);
      const age = Date.now() - data.timestamp;

      // ตรวจสอบอายุของข้อมูล
      if (age > maxAge) {
        console.log(`🗑️ Draft too old (${Math.floor(age / (24 * 60 * 60 * 1000))} days), removing...`);
        localStorage.removeItem(storageKey);
        return false;
      }

      // ตรวจสอบว่าเป็นห้องเดียวกัน
      if (data.roomId !== roomId) {
        console.warn("⚠️ Draft room mismatch, skipping load");
        return false;
      }

      // Apply state to Yjs document
      const state = new Uint8Array(data.state);
      Y.applyUpdate(ydoc, state);

      console.log(`📂 Loaded from localStorage:`, {
        room: roomId,
        age: `${Math.floor(age / 1000)}s ago`,
        elements: ydoc.getMap("elements").size,
        timestamp: new Date(data.timestamp).toLocaleString(),
      });

      setLastSaved(data.timestamp);
      return true;
    } catch (error) {
      console.error("❌ Failed to load from localStorage:", error);
      // ลบข้อมูลที่เสียหาย
      localStorage.removeItem(storageKey);
      return false;
    }
  }, [enabled, ydoc, roomId, storageKey, maxAge]);

  /**
   * ลบ draft จาก localStorage
   */
  const clearLocal = useCallback(() => {
    if (typeof window === "undefined") return;

    try {
      localStorage.removeItem(storageKey);
      setLastSaved(null);
      console.log("🗑️ Cleared localStorage draft");
    } catch (error) {
      console.error("❌ Failed to clear localStorage:", error);
    }
  }, [storageKey]);

  /**
   * ตรวจสอบว่ามี draft อยู่หรือไม่
   */
  const hasDraft = useCallback((): boolean => {
    if (typeof window === "undefined") return false;

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return false;

      const data = JSON.parse(saved);
      const age = Date.now() - data.timestamp;

      return age <= maxAge && data.roomId === roomId;
    } catch {
      return false;
    }
  }, [storageKey, maxAge, roomId]);

  /**
   * ดึงข้อมูล draft
   */
  const getDraftInfo = useCallback((): DraftInfo | null => {
    if (typeof window === "undefined") return null;

    try {
      const saved = localStorage.getItem(storageKey);
      if (!saved) return null;

      const data = JSON.parse(saved);
      const age = Date.now() - data.timestamp;
      const sizeKB = new Blob([saved]).size / 1024;

      return {
        timestamp: data.timestamp,
        roomId: data.roomId,
        age,
        sizeKB,
      };
    } catch {
      return null;
    }
  }, [storageKey]);

  // Auto-save ทุกๆ interval
  useEffect(() => {
    if (!enabled || !ydoc || autoSaveInterval <= 0) return;

    const interval = setInterval(() => {
      saveToLocal();
    }, autoSaveInterval);

    return () => clearInterval(interval);
  }, [enabled, ydoc, autoSaveInterval, saveToLocal]);

  // Save ก่อนออกจากหน้า
  useEffect(() => {
    if (!enabled || !ydoc || typeof window === "undefined") return;

    const handleBeforeUnload = () => {
      saveToLocal();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [enabled, ydoc, saveToLocal]);

  // Debounced save on Yjs changes
  useEffect(() => {
    if (!enabled || !ydoc) return;

    let saveTimeout: NodeJS.Timeout;

    const handleUpdate = () => {
      // Debounce save (รอ 2 วินาทีหลังจากการเปลี่ยนแปลงล่าสุด)
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveToLocal();
      }, 2000);
    };

    ydoc.on("update", handleUpdate);

    return () => {
      ydoc.off("update", handleUpdate);
      clearTimeout(saveTimeout);
    };
  }, [enabled, ydoc, saveToLocal]);

  return {
    saveToLocal,
    loadFromLocal,
    clearLocal,
    hasDraft,
    getDraftInfo,
    lastSaved,
  };
}
