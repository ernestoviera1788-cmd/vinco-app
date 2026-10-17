import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
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
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  DEFAULT_PRIVACY,
  buildFullProfile,
  deleteAccount as apiDeleteAccount,
  deleteProfilePhoto,
  listMyPhotos,
  listSessions,
  reorderProfilePhotos,
  revokeSession,
  setPrimaryPhoto,
  updateNotificationSettings,
  updatePrivacy,
  updateProfile,
  uploadProfilePhoto,
} from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import type { FullProfile, Locale, NotificationSettings, ProfilePhoto, ProfilePrivacy, Session } from '../../src/api/types';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { GenderPicker } from '../../src/components/GenderPicker';
import { SectionTitle, ToggleRow } from '../../src/components/Rows';
import { colors, radius, spacing, type } from '../../src/theme';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

function ageOf(birthDate?: string): number | null {
  if (!birthDate) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(birthDate);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  // Guard against impossible calendar dates rolling over silently.
  if (Number.isNaN(d.getTime()) || d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== day) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

export default function Profile() {
  const { t, locale, setLocale } = useI18n();
  const { token, me, signOut, refreshMe, changeLocale } = useAuth();

  const [profile, setProfile] = useState<FullProfile>(buildFullProfile({}));
  const [privacy, setPrivacy] = useState<ProfilePrivacy>(DEFAULT_PRIVACY);
  const [notif, setNotif] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [photos, setPhotos] = useState<ProfilePhoto[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [deleteText, setDeleteText] = useState('');

  // Seed editable state from the last `getme`.
  // firstName/city/state/country/gender live on the users row (not the
  // profile row), so always overlay them — otherwise the form shows empty
  // fields and saving fails with INVALID_ARGS.
  useEffect(() => {
    const base = buildFullProfile(me?.profile ?? {});
    if (me?.user) {
      const u = me.user;
      if (u.firstName) base.firstName = u.firstName;
      if (u.city) base.city = u.city;
      if (u.state) base.state = u.state;
      if (u.country) base.country = u.country;
      if (u.gender) base.gender = u.gender;
    }
    setProfile(base);
    if (me?.privacy) setPrivacy(me.privacy);
    if (me?.notificationSettings) setNotif(me.notificationSettings);
    if (me?.photos) setPhotos(me.photos);
  }, [me]);

  const loadSessions = useCallback(async () => {
    if (!token) return;
    try {
      setSessions(await listSessions(token));
    } catch {
      // Sessions list is best-effort.
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      void refreshMe();
      void loadSessions();
    }, [refreshMe, loadSessions]),
  );

  function toggle(section: string) {
    setExpanded((e) => (e === section ? null : section));
  }

  async function guard<T>(fn: () => Promise<T>, okMsg?: string): Promise<T | null> {
    if (!token) return null;
    setSaving(true);
    setError('');
    try {
      const res = await fn();
      if (okMsg) setNotice(okMsg);
      return res;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
      return null;
    } finally {
      setSaving(false);
    }
  }

  // ---- profile form -------------------------------------------------------
  const setP = (k: keyof FullProfile, v: string | number) =>
    setProfile((p) => ({ ...p, [k]: v }));

  async function saveProfile() {
    // updateprofile requires ALL fields — `profile` is always the full object.
    // Normalize gender values: the server does case-sensitive matching, so
    // ensure exact "Hombre"/"Mujer" regardless of how the user typed it.
    const normGender = (v: string) => {
      const t = v.trim().toLowerCase();
      if (t === 'hombre' || t === 'man') return 'Hombre';
      if (t === 'mujer' || t === 'woman') return 'Mujer';
      return v.trim();
    };
    const ok = await guard(() => updateProfile(token ?? '', {
      ...profile,
      gender: normGender(profile.gender),
      preferredGender: normGender(profile.preferredGender),
      ageMin: Number(profile.ageMin) || 18,
      ageMax: Number(profile.ageMax) || 99,
      distanceMax: Number(profile.distanceMax) || 50,
    }), t.profile.saved);
    if (ok !== null) void refreshMe();
  }

  // ---- photos --------------------------------------------------------------
  async function addPhoto() {
    if (!token) return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const b64 = asset.base64 ?? '';
    if (!b64) return;
    if (b64.length * 0.75 > MAX_PHOTO_BYTES) {
      setError(t.errors.photoTooLarge);
      return;
    }
    const mimeType = asset.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    if (mimeType !== 'image/jpeg' && mimeType !== 'image/png') {
      setError(t.errors.photoInvalidType);
      return;
    }
    const uploaded = await guard(() =>
      uploadProfilePhoto(token, {
        name: asset.fileName ?? `photo-${Date.now()}.jpg`,
        mimeType,
        dataBase64: b64,
        altText: fmt(t.profile.photoAltText, { name: me?.user.firstName ?? t.profile.photoAltUser }),
      }),
    );
    if (uploaded !== null) {
      setPhotos(await listMyPhotos(token).catch(() => photos));
      setNotice(t.profile.saved);
    }
  }

  async function removePhoto(photo: ProfilePhoto) {
    if (!token) return;
    Alert.alert(t.profile.deletePhoto, t.profile.deletePhotoConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.deletePhoto, style: 'destructive',
        onPress: () => void (async () => {
          const ok = await guard(() => deleteProfilePhoto(token, photo.id), t.profile.saved);
          if (ok !== null) setPhotos((ps) => ps.filter((p) => p.id !== photo.id));
        })(),
      },
    ]);
  }

  async function makePrimary(photo: ProfilePhoto) {
    if (!token) return;
    const ok = await guard(() => setPrimaryPhoto(token, photo.id), t.profile.saved);
    if (ok !== null) {
      setPhotos((ps) => ps.map((p) => ({ ...p, isPrimary: p.id === photo.id })));
    }
  }

  async function movePhoto(index: number, dir: -1 | 1) {
    if (!token) return;
    const next = [...photos];
    const j = index + dir;
    if (j < 0 || j >= next.length) return;
    [next[index], next[j]] = [next[j], next[index]];
    const ok = await guard(() => reorderProfilePhotos(token, next.map((p) => p.id)), t.profile.saved);
    if (ok !== null) setPhotos(next);
  }

  // ---- privacy / notifications / locale ------------------------------------
  async function savePrivacy(next: ProfilePrivacy) {
    setPrivacy(next);
    await guard(() => updatePrivacy(token ?? '', next), t.profile.saved);
  }

  async function saveNotif(next: NotificationSettings) {
    setNotif(next);
    await guard(() => updateNotificationSettings(token ?? '', next), t.profile.saved);
  }

  async function switchLocale(l: Locale) {
    setLocale(l);
    await changeLocale(l);
  }

  async function revoke(s: Session) {
    if (!token) return;
    Alert.alert(t.profile.revoke, t.profile.revokeConfirm, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.revoke, style: 'destructive',
        onPress: () => void (async () => {
          await guard(() => revokeSession(token, s.id), t.profile.saved);
          setSessions((ss) => ss.filter((x) => x.id !== s.id));
        })(),
      },
    ]);
  }

  async function handleDelete() {
    if (!token || deleteText.trim() !== t.profile.deleteConfirmLabel) return;
    Alert.alert(t.profile.deleteTitle, t.profile.deleteBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.profile.deleteAccount, style: 'destructive',
        onPress: () => void (async () => {
          try {
            await apiDeleteAccount(token);
          } catch (e) {
            setError(e instanceof ApiError ? e.message : t.errors.unknown);
            return;
          }
          await signOut();
          router.replace('/(auth)/welcome');
        })(),
      },
    ]);
  }

  const user = me?.user;
  const age = ageOf(user?.birthDate);
  const primary = photos.find((p) => p.isPrimary) ?? photos[0];

  return (
    <Screen>
      {/* header */}
      <View style={styles.header}>
        {primary?.url ? (
          <Image source={{ uri: primary.url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>♡</Text>
          </View>
        )}
        <Text style={styles.name}>
          {user?.firstName ?? '—'}{typeof age === 'number' ? `, ${age}` : ''}
        </Text>
        {user?.email ? <Text style={styles.dim}>{user.email}</Text> : null}
        <View style={styles.verifyRow}>
          <Pressable
            style={styles.verifyChip}
            onPress={() => router.push({ pathname: '/(auth)/verify-otp', params: { channel: 'email' } })}>
            <Text style={styles.verifyText}>
              {user?.emailVerified ? `✓ ${t.profile.verified}` : t.profile.verifyEmail}
            </Text>
          </Pressable>
          {user?.phone ? (
            <Pressable
              style={styles.verifyChip}
              onPress={() => router.push({ pathname: '/(auth)/verify-otp', params: { channel: 'phone' } })}>
              <Text style={styles.verifyText}>
                {user?.phoneVerified ? `✓ ${t.profile.verified}` : t.profile.verifyPhone}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* edit profile */}
      <Pressable onPress={() => toggle('edit')} style={styles.sectionBtn}>
        <Text style={styles.sectionBtnText}>{t.profile.editProfile}</Text>
        <Ionicons name={expanded === 'edit' ? 'chevron-up' : 'chevron-down'} size={20} color={colors.inkSoft} />
      </Pressable>
      {expanded === 'edit' && (
        <View style={styles.sectionBody}>
          <TextField label={t.register.firstName} value={profile.firstName} onChangeText={(v) => setP('firstName', v)} />
          <TextField label={t.register.bio} value={profile.bio} onChangeText={(v) => setP('bio', v)} multiline numberOfLines={3} maxLength={500} />
          <TextField label={t.register.city} value={profile.city} onChangeText={(v) => setP('city', v)} />
          <TextField label={t.register.state} value={profile.state} onChangeText={(v) => setP('state', v)} />
          <TextField label={t.register.country} value={profile.country} onChangeText={(v) => setP('country', v)} />
          <GenderPicker label={t.register.gender} value={profile.gender} onChange={(v) => setP('gender', v)}
            options={[
              { value: 'Hombre', label: t.register.genderMan },
              { value: 'Mujer', label: t.register.genderWoman },
            ]} />
          <TextField label={t.register.intention} value={profile.intention} onChangeText={(v) => setP('intention', v)} />
          <TextField label={t.register.occupation} value={profile.occupation} onChangeText={(v) => setP('occupation', v)} />
          <TextField label={t.register.education} value={profile.education} onChangeText={(v) => setP('education', v)} />
          <TextField label={t.register.hobbies} value={profile.hobbies} onChangeText={(v) => setP('hobbies', v)} />
          <TextField label={t.register.lifestyle} value={profile.lifestyle} onChangeText={(v) => setP('lifestyle', v)} />
          <Button title={t.common.save} onPress={() => void saveProfile()} loading={saving} />
        </View>
      )}

      {/* photos */}
      <Pressable onPress={() => toggle('photos')} style={styles.sectionBtn}>
        <Text style={styles.sectionBtnText}>{t.profile.photos} ({photos.length}/6)</Text>
        <Ionicons name={expanded === 'photos' ? 'chevron-up' : 'chevron-down'} size={20} color={colors.inkSoft} />
      </Pressable>
      {expanded === 'photos' && (
        <View style={styles.sectionBody}>
          <Text style={styles.dim}>{t.profile.maxPhotos}</Text>
          <View style={styles.photoGrid}>
            {photos.map((p, i) => (
              <View key={p.id} style={styles.photoCell}>
                <Image source={{ uri: p.url }} style={styles.thumb} />
                {p.isPrimary ? <Text style={styles.primaryBadge}>★</Text> : null}
                <View style={styles.photoActions}>
                  <Pressable onPress={() => void movePhoto(i, -1)} style={styles.miniBtn}><Text>←</Text></Pressable>
                  <Pressable onPress={() => void movePhoto(i, 1)} style={styles.miniBtn}><Text>→</Text></Pressable>
                </View>
                <View style={styles.photoActions}>
                  {!p.isPrimary ? (
                    <Pressable onPress={() => void makePrimary(p)}><Text style={styles.linkSm}>{t.profile.setPrimary}</Text></Pressable>
                  ) : null}
                  <Pressable onPress={() => void removePhoto(p)}><Text style={styles.dangerSm}>{t.profile.deletePhoto}</Text></Pressable>
                </View>
              </View>
            ))}
          </View>
          {photos.length < 6 ? (
            <Button title={t.profile.addPhoto} variant="secondary" onPress={() => void addPhoto()} loading={saving} />
          ) : null}
        </View>
      )}

      <SectionTitle>{t.profile.privacy}</SectionTitle>
      <ToggleRow label={t.profile.profileVisible} value={privacy.profileVisible}
        onChange={(v) => void savePrivacy({ ...privacy, profileVisible: v })} />
      <ToggleRow label={t.profile.showDistance} value={privacy.showDistance}
        onChange={(v) => void savePrivacy({ ...privacy, showDistance: v })} />
      <ToggleRow label={t.profile.showOnline} value={privacy.showOnline}
        onChange={(v) => void savePrivacy({ ...privacy, showOnline: v })} />

      <SectionTitle>{t.profile.notificationsTitle}</SectionTitle>
      <ToggleRow label={t.profile.notifLikes} value={notif.likes} onChange={(v) => void saveNotif({ ...notif, likes: v })} />
      <ToggleRow label={t.profile.notifMatches} value={notif.matches} onChange={(v) => void saveNotif({ ...notif, matches: v })} />
      <ToggleRow label={t.profile.notifMessages} value={notif.messages} onChange={(v) => void saveNotif({ ...notif, messages: v })} />
      <ToggleRow label={t.profile.notifSecurity} value={notif.security} onChange={(v) => void saveNotif({ ...notif, security: v })} />
      <ToggleRow label={t.profile.notifMarketing} value={notif.marketing} onChange={(v) => void saveNotif({ ...notif, marketing: v })} />

      <SectionTitle>{t.profile.language}</SectionTitle>
      <View style={styles.row}>
        {(['en', 'es'] as Locale[]).map((l) => (
          <Pressable key={l} onPress={() => void switchLocale(l)}
            style={[styles.langBtn, locale === l && styles.langBtnActive]}>
            <Text style={[styles.langText, locale === l && styles.langTextActive]}>
              {l === 'en' ? t.register.languageEn : t.register.languageEs}
            </Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>{t.profile.sessions}</SectionTitle>
      {sessions.map((s) => (
        <View key={s.id} style={styles.sessionRow}>
          <View style={styles.sessionInfo}>
            <Text style={styles.sessionDevice}>{s.device || s.id.slice(0, 8)}</Text>
            <Text style={styles.dim}>{s.current ? t.profile.currentSession : (s.lastActiveAt ?? s.createdAt ?? '')}</Text>
          </View>
          {!s.current ? (
            <Pressable onPress={() => void revoke(s)}><Text style={styles.dangerSm}>{t.profile.revoke}</Text></Pressable>
          ) : null}
        </View>
      ))}

      <SectionTitle>{t.common.appName}</SectionTitle>
      <Pressable style={styles.linkRow} onPress={() => router.push('/premium')}>
        <Text style={styles.linkRowText}>⭐ {t.premium.title}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
      </Pressable>
      <Pressable style={styles.linkRow} onPress={() => router.push('/notifications')}>
        <Text style={styles.linkRowText}>🔔 {t.profile.inbox}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
      </Pressable>
      <Pressable style={styles.linkRow} onPress={() => router.push('/safety')}>
        <Text style={styles.linkRowText}>🛡 {t.profile.safety}</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
      </Pressable>
      <Pressable style={styles.linkRow} onPress={() => router.push('/diagnostic' as any)}>
        <Text style={styles.linkRowText}>🔧 Diagnóstico</Text>
        <Ionicons name="chevron-forward" size={20} color={colors.inkFaint} />
      </Pressable>

      <SectionTitle>{t.profile.deleteAccount}</SectionTitle>
      <Text style={styles.dim}>{t.profile.deleteBody}</Text>
      <TextField
        label={t.profile.deleteConfirmLabel}
        placeholder={t.profile.deletePlaceholder}
        autoCapitalize="characters"
        value={deleteText}
        onChangeText={setDeleteText}
      />
      <Button
        title={t.profile.deleteAccount}
        variant="danger"
        disabled={deleteText.trim() !== t.profile.deleteConfirmLabel}
        onPress={() => void handleDelete()}
      />

      <View style={styles.logoutWrap}>
        <Button title={t.profile.logOut} variant="secondary" onPress={() => void signOut().then(() => router.replace('/(auth)/welcome'))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: spacing.lg },
  avatar: { width: 110, height: 110, borderRadius: 55 },
  avatarPlaceholder: { backgroundColor: colors.rose100, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 44, color: colors.rose500 },
  name: { fontSize: type.title, fontWeight: '800', color: colors.ink, marginTop: spacing.sm },
  dim: { fontSize: type.small, color: colors.inkFaint, marginTop: 2 },
  verifyRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  verifyChip: { backgroundColor: colors.rose100, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  verifyText: { fontSize: type.small, color: colors.rose600, fontWeight: '700' },
  notice: { color: colors.success, fontSize: type.small, textAlign: 'center', marginBottom: spacing.xs },
  error: { color: colors.danger, fontSize: type.small, textAlign: 'center', marginBottom: spacing.xs },
  sectionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginTop: spacing.sm,
  },
  sectionBtnText: { fontSize: type.body, fontWeight: '700', color: colors.ink },
  sectionBody: { paddingVertical: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginVertical: spacing.sm },
  photoCell: { width: '31%', backgroundColor: colors.card, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 4 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: radius.sm },
  primaryBadge: { position: 'absolute', top: 8, left: 8, fontSize: 18, color: colors.gold },
  photoActions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4, paddingVertical: 2 },
  miniBtn: { padding: 4 },
  linkSm: { fontSize: type.caption, color: colors.rose600, fontWeight: '700' },
  dangerSm: { fontSize: type.caption, color: colors.danger, fontWeight: '700' },
  langBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: colors.card },
  langBtnActive: { borderColor: colors.rose500, backgroundColor: colors.rose100 },
  langText: { fontSize: type.body, color: colors.inkSoft, fontWeight: '600' },
  langTextActive: { color: colors.rose600, fontWeight: '800' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  sessionInfo: { flex: 1 },
  sessionDevice: { fontSize: type.body, color: colors.ink, fontWeight: '600' },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  linkRowText: { fontSize: type.body, color: colors.ink, fontWeight: '600' },
  logoutWrap: { marginTop: spacing.xl, marginBottom: spacing.xl },
});
