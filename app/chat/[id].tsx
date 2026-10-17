import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { listMessages, sendMessage, setTyping } from '../../src/api/actions';
import { refreshUnreadMessages } from '../../src/notifications/unread';
import { playMessageSound } from '../../src/notifications/sound';
import { ApiError } from '../../src/api/client';
import type { ChatMessage } from '../../src/api/types';
import { StubBanner } from '../../src/components/StubBanner';
import { EmptyState } from '../../src/components/EmptyState';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * 1:1 chat. No websocket/push action exists on the backend, so this polls
 * `listmessages` every ~5s and sends `settyping` while the user types.
 */
const POLL_MS = 5000;

export default function Chat() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string; photo?: string }>();
  const { t } = useI18n();
  const { token, me } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showCallStub, setShowCallStub] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const myUserId = me?.user.id ?? '';
  const seenIds = useRef<Set<string>>(new Set());
  const firstLoad = useRef(true);

  // New conversation: reset the "already seen" tracking for the ding.
  useEffect(() => {
    seenIds.current = new Set();
    firstLoad.current = true;
  }, [id]);

  const load = useCallback(async () => {
    if (!token || !id) return;
    try {
      const msgs = await listMessages(token, id, myUserId);
      setMessages(msgs);
      // Ding on new incoming messages (not on first load, not for own messages).
      if (!firstLoad.current) {
        const fresh = msgs.some((m) => !m.mine && !seenIds.current.has(m.id));
        if (fresh) void playMessageSound();
      }
      firstLoad.current = false;
      msgs.forEach((m) => seenIds.current.add(m.id));
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
    }
  }, [token, id, myUserId]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Opening the chat marks its message notifications as read on the server
  // (listmessages does it); refresh the Messages-tab dot immediately.
  useEffect(() => {
    if (token && id) void refreshUnreadMessages(token);
  }, [token, id]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (token && id) void setTyping(token, id, false);
    };
  }, [token, id]);

  function handleDraftChange(text: string) {
    setDraft(text);
    if (!token || !id) return;
    void setTyping(token, id, true);
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (token && id) void setTyping(token, id, false);
    }, 2500);
  }

  async function handleSend() {
    const body = draft.trim();
    if (!body || !token || !id || sending) return;
    if (body.length > 2000) return;
    setSending(true);
    setDraft('');
    if (typingTimer.current) clearTimeout(typingTimer.current);
    void setTyping(token, id, false);
    // Optimistic bubble; replaced on next poll if the server disagrees.
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      conversationId: id,
      senderId: myUserId,
      body,
      readAt: null,
      createdAt: new Date().toISOString(),
      mine: true,
    };
    setMessages((ms) => [...ms, optimistic]);
    try {
      const sent = await sendMessage(token, id, body);
      if (sent) {
        setMessages((ms) => ms.map((m) => (m.id === optimistic.id ? sent : m)));
      } else {
        void load();
      }
    } catch (e) {
      setMessages((ms) => ms.filter((m) => m.id !== optimistic.id));
      setError(e instanceof ApiError ? e.message : t.chat.errorSend);
      setDraft(body);
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}>
      <Stack.Screen
        options={{
          title: name || t.tabs.messages,
          headerRight: () => (
            <Pressable onPress={() => setShowCallStub((s) => !s)} style={styles.callBtn} accessibilityLabel={t.chat.callStub}>
              <Ionicons name="videocam-outline" size={24} color={colors.rose600} />
            </Pressable>
          ),
        }}
      />
      {showCallStub ? (
        <View style={styles.stubWrap}>
          <StubBanner title={t.chat.callStub} body={t.chat.callStubBody} />
        </View>
      ) : null}
      {messages.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState title={name || '♡'} body={t.messages.noMessagesYet} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
              <Text style={[styles.msgText, item.mine ? styles.mineText : styles.theirsText]}>
                {item.body}
              </Text>
              {item.mine ? (
                <Text style={styles.readState}>{item.readAt ? '✓✓' : '✓'}</Text>
              ) : null}
            </View>
          )}
        />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder={t.chat.typeMessage}
          placeholderTextColor={colors.inkFaint}
          value={draft}
          onChangeText={handleDraftChange}
          multiline
          maxLength={2000}
        />
        <Pressable
          onPress={() => void handleSend()}
          disabled={sending || !draft.trim()}
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          accessibilityLabel={t.common.send}>
          <Ionicons name="send" size={20} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  callBtn: { padding: spacing.sm, marginRight: spacing.sm },
  stubWrap: { paddingHorizontal: spacing.md },
  emptyWrap: { flex: 1 },
  list: { padding: spacing.md, gap: spacing.sm },
  bubble: { maxWidth: '78%', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 9 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.rose500, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  msgText: { fontSize: type.body, lineHeight: 22 },
  mineText: { color: '#fff' },
  theirsText: { color: colors.ink },
  readState: { fontSize: type.caption, color: 'rgba(255,255,255,0.75)', alignSelf: 'flex-end', marginTop: 2 },
  error: { color: colors.danger, fontSize: type.small, textAlign: 'center', paddingVertical: 4 },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end',
    padding: spacing.sm, gap: spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.card,
  },
  input: {
    flex: 1, maxHeight: 110,
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10,
    fontSize: type.body, color: colors.ink,
  },
  sendBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.rose600, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
