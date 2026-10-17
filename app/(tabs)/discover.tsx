import { useCallback, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n, fmt } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { listDiscovery, reactToProfile } from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import type { DiscoveryCard } from '../../src/api/types';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorView } from '../../src/components/EmptyState';
import { MatchModal } from '../../src/components/MatchModal';
import { colors, radius, spacing, type } from '../../src/theme';

type ReactKind = 'LIKE' | 'PASS' | 'SUPER_LIKE';

export default function Discover() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [cards, setCards] = useState<DiscoveryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reacting, setReacting] = useState(false);
  const [matchInfo, setMatchInfo] = useState<{ name: string; photoUrl?: string; matchId: string } | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      const result = await listDiscovery(token);
      setCards(result);
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

  async function react(kind: ReactKind) {
    const top = cards[0];
    if (!top || !token || reacting) return;
    setReacting(true);
    try {
      const res = await reactToProfile(token, top.id, kind);
      setCards((c) => c.slice(1));
      if (res.matched) {
        setMatchInfo({
          name: top.firstName,
          photoUrl: top.photos[0]?.url,
          matchId: res.match?.id ?? '',
        });
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setReacting(false);
    }
  }

  const top = cards[0];

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.discover.title}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><Text style={styles.dim}>{t.common.loading}</Text></View>
      ) : error && cards.length === 0 ? (
        <ErrorView message={error} onRetry={() => { setLoading(true); void load(); }} retryLabel={t.common.retry} />
      ) : !top ? (
        <EmptyState title={t.discover.emptyTitle} body={t.discover.emptyBody} />
      ) : (
        <View style={styles.deck}>
          <View style={styles.card}>
            {top.photos[0]?.url ? (
              <Image source={{ uri: top.photos[0].url }} style={styles.photo} />
            ) : (
              <View style={[styles.photo, styles.photoPlaceholder]}>
                <Text style={styles.photoPlaceholderText}>♡</Text>
              </View>
            )}
            <View style={styles.cardBody}>
              <Text style={styles.name}>
                {top.firstName}
                {typeof top.age === 'number' ? `, ${top.age}` : ''}
              </Text>
              <Text style={styles.meta}>
                {[top.city, typeof top.distanceKm === 'number' ? fmt(t.discover.kmAway, { km: Math.round(top.distanceKm) }) : '']
                  .filter(Boolean)
                  .join(' · ')}
                {top.online ? ` · ${t.discover.online} 🟢` : ''}
              </Text>
              {top.intention ? <Text style={styles.intention}>💘 {top.intention}</Text> : null}
              {top.bio ? <Text style={styles.bio}>{top.bio}</Text> : null}
              {top.interests && top.interests.length > 0 ? (
                <View style={styles.chips}>
                  {top.interests.slice(0, 8).map((chip, i) => (
                    <View key={i} style={styles.chip}><Text style={styles.chipText}>{chip}</Text></View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable
              accessibilityLabel={t.discover.pass}
              onPress={() => void react('PASS')}
              style={[styles.actionBtn, styles.passBtn]}>
              <Ionicons name="close" size={30} color={colors.inkSoft} />
            </Pressable>
            <Pressable
              accessibilityLabel={t.discover.superLike}
              onPress={() => void react('SUPER_LIKE')}
              style={[styles.actionBtn, styles.superBtn]}>
              <Ionicons name="star" size={26} color={colors.gold} />
            </Pressable>
            <Pressable
              accessibilityLabel={t.discover.like}
              onPress={() => void react('LIKE')}
              style={[styles.actionBtn, styles.likeBtn]}>
              <Ionicons name="heart" size={30} color="#fff" />
            </Pressable>
          </View>
          <Text style={styles.hint}>
            {t.discover.pass} · {t.discover.superLike} · {t.discover.like}
          </Text>
        </View>
      )}
      <MatchModal
        visible={matchInfo !== null}
        name={matchInfo?.name ?? ''}
        photoUrl={matchInfo?.photoUrl}
        onKeepSwiping={() => setMatchInfo(null)}
        onSendMessage={() => {
          setMatchInfo(null);
          router.push('/(tabs)/matches');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: type.title, fontWeight: '900', color: colors.ink },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: colors.inkFaint, fontSize: type.body },
  deck: { flex: 1, padding: spacing.lg, paddingTop: spacing.sm },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  photo: { width: '100%', height: '58%' },
  photoPlaceholder: { backgroundColor: colors.plum800, alignItems: 'center', justifyContent: 'center' },
  photoPlaceholderText: { fontSize: 64, color: colors.rose400 },
  cardBody: { padding: spacing.md, flex: 1 },
  name: { fontSize: type.title, fontWeight: '800', color: colors.ink },
  meta: { fontSize: type.small, color: colors.inkSoft, marginTop: 2 },
  intention: { fontSize: type.small, color: colors.rose600, fontWeight: '700', marginTop: spacing.xs },
  bio: { fontSize: type.body, color: colors.ink, marginTop: spacing.sm, lineHeight: 22 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { backgroundColor: colors.rose100, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: type.small, color: colors.rose600, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  actionBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
  },
  passBtn: {},
  superBtn: { width: 56, height: 56, borderRadius: 28 },
  likeBtn: { backgroundColor: colors.rose500, borderColor: colors.rose500, width: 72, height: 72, borderRadius: 36 },
  hint: { textAlign: 'center', color: colors.inkFaint, fontSize: type.caption, marginTop: spacing.sm },
});
