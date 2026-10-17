import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useI18n } from '../src/i18n';
import { useAuth } from '../src/auth/AuthContext';
import { listNotifications, markNotificationRead } from '../src/api/actions';
import { ApiError } from '../src/api/client';
import type { AppNotification } from '../src/api/types';
import { Screen } from '../src/components/Screen';
import { EmptyState, ErrorView } from '../src/components/EmptyState';
import { StubBanner } from '../src/components/StubBanner';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * In-app notification inbox (`listnotifications` / `marknotificationread`).
 * This feed is REAL. OS-level push delivery is stubbed (banner below) because
 * no `registerpushdevice` action exists on the backend.
 */
export default function Notifications() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      setItems(await listNotifications(token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load]),
  );

  async function markRead(n: AppNotification) {
    if (!token || n.readAt) return;
    try {
      await markNotificationRead(token, n.id);
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
    } catch {
      // Best-effort; the row stays unread.
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.notifications.title}</Text>
      </View>
      <View style={styles.bannerWrap}>
        <StubBanner title={t.notifications.pushTitle} body={t.notifications.pushBody} />
      </View>
      {loading ? (
        <View style={styles.center}><Text style={styles.dim}>{t.common.loading}</Text></View>
      ) : error && items.length === 0 ? (
        <ErrorView message={error} onRetry={() => { setLoading(true); void load(); }} retryLabel={t.common.retry} />
      ) : items.length === 0 ? (
        <EmptyState title={t.notifications.emptyTitle} body={t.notifications.emptyBody} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.row, !item.readAt && styles.unread]}
              onPress={() => void markRead(item)}>
              <View style={[styles.dot, !item.readAt && styles.dotActive]} />
              <View style={styles.info}>
                <Text style={styles.rowTitle}>{item.title || item.type}</Text>
                {item.body ? <Text style={styles.rowBody}>{item.body}</Text> : null}
                {item.createdAt ? <Text style={styles.dim}>{item.createdAt}</Text> : null}
              </View>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: type.title, fontWeight: '900', color: colors.ink },
  bannerWrap: { paddingHorizontal: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { fontSize: type.small, color: colors.inkFaint, marginTop: 2 },
  list: { padding: spacing.lg, paddingTop: spacing.sm, gap: spacing.sm },
  row: {
    flexDirection: 'row', backgroundColor: colors.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, alignItems: 'flex-start',
  },
  unread: { borderColor: colors.rose400 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 5, marginRight: spacing.sm },
  dotActive: { backgroundColor: colors.rose500 },
  info: { flex: 1 },
  rowTitle: { fontSize: type.body, fontWeight: '700', color: colors.ink },
  rowBody: { fontSize: type.small, color: colors.inkSoft, marginTop: 2, lineHeight: 20 },
});
