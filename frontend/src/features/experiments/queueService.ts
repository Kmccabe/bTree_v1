export type QueuedSubject = {
  subjectId: string;
  walletShort: string;
  reputationLabel: string;
  joinedAt: number;
};

const STORAGE_PREFIX = "btree_queue_";

export const DEFAULT_SESSION_ID = "trust-game-session-1";

function getQueueKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`;
}

function readQueue(sessionId: string): QueuedSubject[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(getQueueKey(sessionId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed as QueuedSubject[];
    }
    return [];
  } catch (error) {
    console.error("[queue] failed to parse queue", error);
    return [];
  }
}

function writeQueue(sessionId: string, items: QueuedSubject[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getQueueKey(sessionId), JSON.stringify(items));
}

export async function enqueueSubject(sessionId: string, data: QueuedSubject): Promise<void> {
  const items = readQueue(sessionId);
  items.push({ ...data });
  writeQueue(sessionId, items);
  console.info("[queue] enqueueSubject", sessionId, data);
}

export async function getQueuedSubjects(sessionId: string): Promise<QueuedSubject[]> {
  const items = readQueue(sessionId);
  console.info("[queue] getQueuedSubjects", sessionId, items);
  return items;
}

export function formatJoinedLabel(joinedAt: number): string {
  const diffMs = Date.now() - joinedAt;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes <= 0) {
    const seconds = Math.max(5, Math.floor(diffMs / 1000));
    return `${seconds}s ago`;
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? "" : "s"} ago`;
}
