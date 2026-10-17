import { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { listLikes, reactToProfile } from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import type { IncomingLike } from '../../src/api/types';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { EmptyState, ErrorView } from '../../src/components/EmptyState';
import { colors, radius, spacing, type } from '../../src/theme';

/**
 * Incoming likes (`listlikes`). Premium gating is enforced server-side —
 * the app shows whatever the backend returns, nothing is faked.
 */
export default function Likes() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [likes, setLikes] = useState<IncomingLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      setLikes(await listLikes(token));
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

  async function likeBack(like: IncomingLike) {
    if (!token || busyId) return;
    setBusyId(like.id);
    try {
      await reactToProfile(token, like.senderId, 'LIKE');
      setLikes((ls) => ls.filter((l) => l.id !== like.id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.tabs.likes}</Text>
        <Text style={styles.note}>{t.likes.premiumNote}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><Text style={styles.dim}>{t.common.loading}</Text></View>
      ) : error && likes.length === 0 ? (
        <ErrorView message={error} onRetry={() => { setLoading(true); void load(); }} retryLabel={t.common.retry} />
      ) : likes.length === 0 ? (
        <EmptyState title={t.likes.emptyTitle} body={t.likes.emptyBody} />
      ) : (
        <FlatList
          data={likes}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.row}>
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
                {item.kind === 'SUPER_LIKE' ? (
                  <Text style={styles.superBadge}>★ {t.likes.superLikeBadge}</Text>
                ) : null}
                {item.city ? <Text style={styles.city}>{item.city}</Text> : null}
              </View>
              <Button
                title={t.likes.likeBack}
                variant="secondary"
                loading={busyId === item.id}
                onPress={() => void likeBack(item)}
                style={styles.likeBtn}
              />
            </View>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: type.title, fontWeight: '900', color: colors.ink },
  note: { fontSize: type.small, color: colors.inkFaint, marginTop: 4, lineHeight: 18 },
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
  superBadge: { fontSize: type.caption, fontWeight: '800', color: colors.gold, marginTop: 2 },
  city: { fontSize: type.small, color: colors.inkSoft },
  likeBtn: { minHeight: 44, paddingVertical: 10, paddingHorizontal: spacing.md },
});
