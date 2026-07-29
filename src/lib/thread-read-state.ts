// Per-user thread read state stored in localStorage.
// Value: { [conversationId]: ISO timestamp when marked read }
import { useCallback, useEffect, useState } from "react";

const keyFor = (userId: string | null | undefined) =>
  userId ? `askjanice.threads.read.${userId}` : null;

type ReadMap = Record<string, string>;

function load(userId: string | null | undefined): ReadMap {
  const k = keyFor(userId);
  if (!k || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as ReadMap) : {};
  } catch {
    return {};
  }
}

function save(userId: string | null | undefined, map: ReadMap) {
  const k = keyFor(userId);
  if (!k || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(k, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

export function markThreadRead(userId: string | null | undefined, convId: string) {
  const k = keyFor(userId);
  if (!k) return;
  const map = load(userId);
  map[convId] = new Date().toISOString();
  save(userId, map);
  try {
    window.dispatchEvent(new CustomEvent("askjanice:thread-read", { detail: { convId } }));
  } catch {
    /* ignore */
  }
}

export function useReadThreads(userId: string | null | undefined) {
  const [map, setMap] = useState<ReadMap>(() => load(userId));

  useEffect(() => {
    setMap(load(userId));
    const onChange = () => setMap(load(userId));
    window.addEventListener("askjanice:thread-read", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("askjanice:thread-read", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [userId]);

  const isUnread = useCallback(
    (convId: string, activityAt: string | null | undefined) => {
      const readAt = map[convId];
      if (!readAt) return true;
      if (!activityAt) return false;
      return new Date(activityAt).getTime() > new Date(readAt).getTime();
    },
    [map],
  );

  const markRead = useCallback(
    (convId: string) => {
      markThreadRead(userId, convId);
      setMap((prev) => ({ ...prev, [convId]: new Date().toISOString() }));
    },
    [userId],
  );

  return { isUnread, markRead };
}
