import { useCallback, useState } from 'react';
import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { listMatches } from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import type { Match } from '../../src/api/types';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorView } from '../../src/components/EmptyState';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * Conversation list. The backend publishes no `listconversations` action, so
 * conversations are derived from `listmatches` (each match carries a
 * conversationId). Matches without a conversation are hidden here.
 */
export default function Messages() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [convos, setConvos] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const matches = await listMatches(token);
      setConvos(matches.filter((m) => m.conversationId));
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

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.tabs.messages}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><Text style={styles.dim}>{t.common.loading}</Text></View>
      ) : error && convos.length === 0 ? (
        <ErrorView message={error} onRetry={() => { setLoading(true); void load(); }} retryLabel={t.common.retry} />
      ) : convos.length === 0 ? (
        <EmptyState title={t.messages.emptyTitle} body={t.messages.emptyBody} />
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() =>
                router.push({
                  pathname: '/chat/[id]',
                  params: { id: item.conversationId ?? '', name: item.firstName ?? '', photo: item.photoUrl ?? '' },
                })
              }>
              {item.photoUrl ? (
                <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarText}>♡</Text>
                </View>
              )}
              <View style={styles.info}>
                <Text style={styles.name}>
                  {item.firstName ?? '—'}
                  {typeof item.age === 'number' ? `, ${item.age}` : ''}
                </Text>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: colors.inkFaint, fontSize: type.body },
  list: { padding: spacing.lg, gap: spacing.sm },
  row: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.sm,
  },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: colors.rose100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, color: colors.rose500 },
  info: { flex: 1, marginLeft: spacing.sm },
  name: { fontSize: type.body, fontWeight: '700', color: colors.ink },
});
