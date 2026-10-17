import { useEffect, useState } from 'react';
import { listNotifications } from '../api/actions';

/**
 * Unread "message" notifications. Drives the dot on the Messages tab and
 * emits a signal when a newly-created unread message notification is seen.
 *
 * The first successful fetch establishes a baseline without playing a sound,
 * so opening the app with old unread messages does not produce a false ding.
 */
let unreadCount = 0;
let seenUnreadToken: string | null = null;
let seenUnreadMessageKeys: Set<string> | null = null;
const listeners = new Set<() => void>();
const newMessageListeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* ignore a broken listener */
    }
  });
}

function emitNewUnreadMessage() {
  newMessageListeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* a sound listener must never break notification refresh */
    }
  });
}

/** Subscribe to newly detected unread message notifications. Returns an unsubscribe function. */
export function subscribeToNewUnreadMessages(listener: () => void): () => void {
  newMessageListeners.add(listener);
  return () => newMessageListeners.delete(listener);
}

/** Re-read the feed and update unread count; returns the last known count on failure. */
export async function refreshUnreadMessages(token: string): Promise<number> {
  // Do not carry unread counts or message identities across account sessions.
  if (seenUnreadToken !== token) {
    seenUnreadToken = token;
    seenUnreadMessageKeys = null;
    if (unreadCount !== 0) {
      unreadCount = 0;
      emit();
    }
  }
  try {
    const items = await listNotifications(token);
    const unreadMessages = items.filter((item) => item.type === 'message' && !item.readAt);
    const nextKeys = new Set(
      unreadMessages.map((item) => `${item.id}:${item.createdAt ?? ''}`),
    );
    const nextCount = unreadMessages.length;

    // Do not sound on the first successful fetch: these notifications may be old.
    if (seenUnreadMessageKeys !== null) {
      const hasNewNotification = [...nextKeys].some((key) => !seenUnreadMessageKeys?.has(key));
      if (hasNewNotification || nextCount > unreadCount) {
        emitNewUnreadMessage();
      }
    }

    seenUnreadMessageKeys = nextKeys;
    if (nextCount !== unreadCount) {
      unreadCount = nextCount;
      emit();
    }
  } catch {
    /* keep last known count and baseline on failure */
  }
  return unreadCount;
}

/** Current unread message count; re-renders the caller when it changes. */
export function useUnreadMessages(): number {
  const [, force] = useState(0);
  useEffect(() => {
    const listener = () => force((value) => value + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return unreadCount;
}
