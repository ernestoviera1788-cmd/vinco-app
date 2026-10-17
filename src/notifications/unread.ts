import { useEffect, useState } from 'react';
import { listNotifications } from '../api/actions';

/**
 * Unread "message" notifications. Drives the dot on the Messages tab.
 *
 * The server marks a conversation's message notifications as read when the
 * chat is opened (`listmessages` does it), so this store only needs to
 * re-read the feed: on tab-layout poll and right when a chat opens.
 * No design or behavior outside the notification dot is touched.
 */

let unreadCount = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* ignore a broken listener */
    }
  });
}

/** Re-read the feed and update the unread message count. Returns the new count (last known on failure). */
export async function refreshUnreadMessages(token: string): Promise<number> {
  try {
    const items = await listNotifications(token);
    const n = items.filter((x) => x.type === 'message' && !x.readAt).length;
    if (n !== unreadCount) {
      unreadCount = n;
      emit();
    }
  } catch {
    /* keep last known count */
  }
  return unreadCount;
}

/** Current unread message count; re-renders the caller when it changes. */
export function useUnreadMessages(): number {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((x) => x + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return unreadCount;
}
