import { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n, fmt } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { buildFullProfile, listDiscovery, reactToProfile, updateProfile } from '../../src/api/actions';
import { GenderPicker } from '../../src/components/GenderPicker';
import { TextField } from '../../src/components/TextField';
import { DEFAULT_SEARCH_FILTERS, loadSearchFilters, saveSearchFilters, type SearchFilters } from '../../src/filters/searchFilters';
import { ApiError } from '../../src/api/client';
import type { DiscoveryCard } from '../../src/api/types';
import { Screen } from '../../src/components/Screen';
import { EmptyState, ErrorView } from '../../src/components/EmptyState';
import { MatchModal } from '../../src/components/MatchModal';
import { colors, radius, spacing, type } from '../../src/theme';

type ReactKind = 'LIKE' | 'PASS' | 'SUPER_LIKE';

export default function Discover() {
  const { t } = useI18n();
  const { token, me, refreshMe } = useAuth();
  const [cards, setCards] = useState<DiscoveryCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reacting, setReacting] = useState(false);
  const [matchInfo, setMatchInfo] = useState<{ name: string; photoUrl?: string; matchId: string } | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [draftFilters, setDraftFilters] = useState<SearchFilters>(DEFAULT_SEARCH_FILTERS);
  const [filtersLoaded, setFiltersLoaded] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void loadSearchFilters().then((saved) => {
      const profile = me?.profile;
      const preferred = profile?.preferredGender;
      const initial: SearchFilters = profile
        ? {
            preferredGender: preferred === 'Hombre' || preferred === 'Mujer' ? preferred : 'Todos',
            ageMin: profile.ageMin,
            ageMax: profile.ageMax,
            distanceMax: profile.distanceMax,
          }
        : saved;
      if (cancelled) return;
      setFilters(initial);
      setDraftFilters(initial);
      setFiltersLoaded(true);
    });
    return () => { cancelled = true; };
  }, [me?.profile]);

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
      if (!filtersLoaded) return;
      setLoading(true);
      void load();
    }, [load, filtersLoaded, filters]),
  );

  async function persistFilters(next: SearchFilters) {
    if (!token) return;
    if (next.ageMin < 18 || next.ageMax > 99 || next.ageMin > next.ageMax || next.distanceMax < 1 || next.distanceMax > 500) {
      setError(t.discover.invalidFilters);
      return;
    }
    const user = me?.user;
    const current = buildFullProfile({
      ...(me?.profile ?? {}),
      firstName: user?.firstName ?? me?.profile?.firstName ?? '',
      city: user?.city ?? me?.profile?.city ?? '',
      state: user?.state ?? me?.profile?.state ?? '',
      country: user?.country ?? me?.profile?.country ?? '',
      gender: user?.gender ?? me?.profile?.gender ?? '',
    });
    await updateProfile(token, {
      ...current,
      preferredGender: next.preferredGender === 'Todos' ? '' : next.preferredGender,
      ageMin: next.ageMin,
      ageMax: next.ageMax,
      distanceMax: next.distanceMax,
    });
    await saveSearchFilters(next);
    setFilters(next);
    setDraftFilters(next);
    await refreshMe();
    setFiltersOpen(false);
    setLoading(true);
    setError('');
  }

  async function applyFilters() {
    try {
      await persistFilters(draftFilters);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    }
  }

  async function resetFilters() {
    setDraftFilters(DEFAULT_SEARCH_FILTERS);
    try {
      await persistFilters(DEFAULT_SEARCH_FILTERS);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    }
  }

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
        <Pressable accessibilityRole="button" style={styles.filterButton} onPress={() => {
          setDraftFilters(filters);
          setFiltersOpen((open) => !open);
        }}>
          <Ionicons name="options-outline" size={18} color={colors.rose600} />
          <Text style={styles.filterButtonText}>{t.discover.filters}</Text>
        </Pressable>
      </View>
      {filtersOpen ? (
        <ScrollView style={styles.filtersPanel} keyboardShouldPersistTaps="handled">
          <Text style={styles.filterHeading}>{t.discover.filterGender}</Text>
          <GenderPicker
            label={t.discover.filterGender}
            value={draftFilters.preferredGender}
            onChange={(value) => setDraftFilters((current) => ({ ...current, preferredGender: value as SearchFilters['preferredGender'] }))}
            options={[
              { value: 'Todos', label: t.discover.everyone },
              { value: 'Mujer', label: t.register.genderWoman },
              { value: 'Hombre', label: t.register.genderMan },
            ]}
          />
          <Text style={styles.filterHeading}>{t.discover.ageRange}</Text>
          <View style={styles.filterInputRow}>
            <View style={styles.filterInput}>
              <TextField label={t.discover.ageMin} keyboardType="number-pad" value={String(draftFilters.ageMin)}
                onChangeText={(value) => setDraftFilters((current) => ({ ...current, ageMin: Number(value) || 18 }))} />
            </View>
            <View style={styles.filterInput}>
              <TextField label={t.discover.ageMax} keyboardType="number-pad" value={String(draftFilters.ageMax)}
                onChangeText={(value) => setDraftFilters((current) => ({ ...current, ageMax: Number(value) || 18 }))} />
            </View>
          </View>
          <TextField label={t.discover.distanceMax} keyboardType="number-pad" value={String(draftFilters.distanceMax)}
            onChangeText={(value) => setDraftFilters((current) => ({ ...current, distanceMax: Number(value) || 1 }))} />
          <View style={styles.filterActions}>
            <Pressable onPress={() => void resetFilters()} style={styles.resetButton}><Text style={styles.resetText}>{t.discover.resetFilters}</Text></Pressable>
            <Pressable onPress={() => void applyFilters()} style={styles.applyButton}><Text style={styles.applyText}>{t.discover.applyFilters}</Text></Pressable>
          </View>
        </ScrollView>
      ) : null}
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
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  filterButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.rose500, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8 },
  filterButtonText: { color: colors.rose600, fontWeight: '700', fontSize: type.small },
  filtersPanel: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card, maxHeight: '52%' },
  filterHeading: { fontSize: type.small, fontWeight: '800', color: colors.ink, marginTop: spacing.xs, marginBottom: spacing.xs },
  filterInputRow: { flexDirection: 'row', gap: spacing.sm },
  filterInput: { flex: 1 },
  filterActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm, gap: spacing.sm },
  resetButton: { paddingVertical: 11, paddingHorizontal: 12 },
  resetText: { color: colors.inkSoft, fontSize: type.small, fontWeight: '700' },
  applyButton: { backgroundColor: colors.rose500, borderRadius: radius.pill, paddingVertical: 11, paddingHorizontal: 18 },
  applyText: { color: '#fff', fontWeight: '800', fontSize: type.small },
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
