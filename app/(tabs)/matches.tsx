import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n, fmt } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { blockUser, listMatches, reportUser, unmatch } from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import type { Match, ReportCategory } from '../../src/api/types';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { EmptyState, ErrorView } from '../../src/components/EmptyState';
import { colors, radius, spacing, type } from '../../src/theme';

const CATEGORIES: { key: ReportCategory; labelKey: keyof typeof import('../../src/i18n/en').en.reportCategories }[] = [
  { key: 'Fake profile', labelKey: 'fake' },
  { key: 'Scam', labelKey: 'scam' },
  { key: 'Harassment', labelKey: 'harassment' },
  { key: 'Spam', labelKey: 'spam' },
  { key: 'Inappropriate content', labelKey: 'inappropriate' },
  { key: 'Threatening behavior', labelKey: 'threatening' },
  { key: 'Impersonation', labelKey: 'impersonation' },
  { key: 'Other', labelKey: 'other' },
];

export default function Matches() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState<Match | null>(null);
  const [category, setCategory] = useState<ReportCategory>('Harassment');
  const [details, setDetails] = useState('');
  const [evidenceB64, setEvidenceB64] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    setError('');
    try {
      setMatches(await listMatches(token));
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

  function confirmUnmatch(m: Match) {
    Alert.alert(
      fmt(t.matches.unmatchTitle, { name: m.firstName ?? '' }),
      t.matches.unmatchBody,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.matches.unmatch,
          style: 'destructive',
          onPress: () => void (async () => {
            if (!token) return;
            try {
              await unmatch(token, m.id);
              setMatches((ms) => ms.filter((x) => x.id !== m.id));
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t.errors.unknown);
            }
          })(),
        },
      ],
    );
  }

  function confirmBlock(m: Match) {
    const targetId = m.otherUserId;
    if (!targetId) return;
    Alert.alert(
      fmt(t.matches.blockTitle, { name: m.firstName ?? '' }),
      t.matches.blockBody,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.matches.block,
          style: 'destructive',
          onPress: () => void (async () => {
            if (!token) return;
            try {
              await blockUser(token, targetId);
              setMatches((ms) => ms.filter((x) => x.id !== m.id));
              setNotice(t.matches.actionSuccess);
            } catch (e) {
              setError(e instanceof ApiError ? e.message : t.errors.unknown);
            }
          })(),
        },
      ],
    );
  }

  async function pickEvidence() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.8,
    });
    if (res.canceled || !res.assets[0]?.base64) return;
    const asset = res.assets[0];
    const b64 = asset.base64 ?? '';
    // ~10MB cap on the encoded payload (base64 inflates by ~4/3).
    if (b64.length > 10 * 1024 * 1024 * 1.4) {
      setError(t.errors.photoTooLarge);
      return;
    }
    setEvidenceB64(b64);
  }

  async function submitReport() {
    if (!reporting || !token || !reporting.otherUserId) return;
    setSubmitting(true);
    setError('');
    try {
      await reportUser(token, {
        targetId: reporting.otherUserId,
        category,
        ...(details.trim() ? { details: details.trim().slice(0, 1000) } : {}),
        ...(evidenceB64
          ? { evidence: { mimeType: 'image/jpeg', dataBase64: evidenceB64, altText: t.matches.reportEvidenceAlt } }
          : {}),
      });
      setReporting(null);
      setDetails('');
      setEvidenceB64(null);
      setNotice(t.matches.reportSuccess);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setSubmitting(false);
    }
  }

  function openChat(m: Match) {
    if (!m.conversationId) return;
    router.push({
      pathname: '/chat/[id]',
      params: { id: m.conversationId, name: m.firstName ?? '', photo: m.photoUrl ?? '' },
    });
  }

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text style={styles.title}>{t.tabs.matches}</Text>
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      </View>
      {loading ? (
        <View style={styles.center}><Text style={styles.dim}>{t.common.loading}</Text></View>
      ) : error && matches.length === 0 ? (
        <ErrorView message={error} onRetry={() => { setLoading(true); void load(); }} retryLabel={t.common.retry} />
      ) : matches.length === 0 ? (
        <EmptyState title={t.matches.emptyTitle} body={t.matches.emptyBody} />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={[styles.main, !item.conversationId && styles.mainDisabled]}
                onPress={() => openChat(item)}
                disabled={!item.conversationId}
                accessibilityLabel={item.conversationId ? t.matches.openChat : undefined}>
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
                  {item.conversationId ? (
                    <Text style={styles.chatCta}>💬 {t.matches.openChat}</Text>
                  ) : null}
                </View>
              </Pressable>
              <View style={styles.rowActions}>
                <Pressable onPress={() => confirmUnmatch(item)} style={styles.iconBtn} accessibilityLabel={t.matches.unmatch}>
                  <Ionicons name="heart-dislike-outline" size={22} color={colors.inkSoft} />
                </Pressable>
                <Pressable onPress={() => confirmBlock(item)} style={styles.iconBtn} accessibilityLabel={t.matches.block}>
                  <Ionicons name="ban-outline" size={22} color={colors.inkSoft} />
                </Pressable>
                <Pressable onPress={() => { setReporting(item); setCategory('Harassment'); }} style={styles.iconBtn} accessibilityLabel={t.matches.report}>
                  <Ionicons name="flag-outline" size={22} color={colors.danger} />
                </Pressable>
              </View>
            </View>
          )}
        />
      )}

      <Modal visible={reporting !== null} animationType="slide" onRequestClose={() => setReporting(null)}>
        <Screen>
          <Text style={styles.title}>{fmt(t.matches.reportTitle, { name: reporting?.firstName ?? '' })}</Text>
          <Text style={styles.label}>{t.matches.reportCategory}</Text>
          <View style={styles.catWrap}>
            {CATEGORIES.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setCategory(c.key)}
                style={[styles.catChip, category === c.key && styles.catChipActive]}>
                <Text style={[styles.catText, category === c.key && styles.catTextActive]}>
                  {t.reportCategories[c.labelKey]}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextField
            label={t.matches.reportDetails}
            placeholder={t.matches.reportDetailsPlaceholder}
            multiline
            numberOfLines={4}
            maxLength={1000}
            value={details}
            onChangeText={setDetails}
          />
          <Button
            title={evidenceB64 ? '✓ ' + t.matches.reportEvidence : t.matches.reportEvidence}
            variant="secondary"
            onPress={() => void pickEvidence()}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.modalActions}>
            <Button title={t.common.cancel} variant="ghost" onPress={() => setReporting(null)} />
            <Button title={t.matches.reportSubmit} onPress={() => void submitReport()} loading={submitting} />
          </View>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  title: { fontSize: type.title, fontWeight: '900', color: colors.ink, marginBottom: spacing.sm },
  notice: { color: colors.success, fontSize: type.small, marginBottom: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  dim: { color: colors.inkFaint, fontSize: type.body },
  list: { padding: spacing.lg, gap: spacing.sm },
  card: {
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.sm,
    flexDirection: 'row', alignItems: 'center',
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  mainDisabled: { opacity: 0.55 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarPlaceholder: { backgroundColor: colors.rose100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 24, color: colors.rose500 },
  info: { flex: 1, marginLeft: spacing.sm },
  name: { fontSize: type.body, fontWeight: '700', color: colors.ink },
  chatCta: { fontSize: type.small, color: colors.rose600, fontWeight: '600', marginTop: 2 },
  rowActions: { flexDirection: 'row' },
  iconBtn: { padding: spacing.sm },
  label: { fontSize: type.small, fontWeight: '600', color: colors.ink, marginTop: spacing.md, marginBottom: spacing.xs },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.card },
  catChipActive: { borderColor: colors.danger, backgroundColor: '#fdeef1' },
  catText: { fontSize: type.small, color: colors.inkSoft, fontWeight: '600' },
  catTextActive: { color: colors.danger, fontWeight: '800' },
  error: { color: colors.danger, fontSize: type.small, marginVertical: spacing.sm, textAlign: 'center' },
  modalActions: { gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.xl },
});
