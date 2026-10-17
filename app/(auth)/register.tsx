import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import { buildFullProfile, register as apiRegister, updateProfile } from '../../src/api/actions';
import { ApiError } from '../../src/api/client';
import type { Locale } from '../../src/api/types';
import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { TextField } from '../../src/components/TextField';
import { GenderPicker } from '../../src/components/GenderPicker';
import { colors, spacing, type } from '../../src/theme';

interface Form {
  email: string;
  password: string;
  firstName: string;
  birthDate: string;
  gender: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  bio: string;
  intention: string;
  occupation: string;
  education: string;
  hobbies: string;
  lifestyle: string;
  preferredGender: string;
  ageMin: string;
  ageMax: string;
  distanceMax: string;
  locale: Locale;
  acceptedTerms: boolean;
}

const INITIAL: Form = {
  email: '', password: '', firstName: '', birthDate: '', gender: '',
  city: '', state: '', country: '', phone: '',
  bio: '', intention: '', occupation: '', education: '', hobbies: '', lifestyle: '',
  preferredGender: '', ageMin: '18', ageMax: '99', distanceMax: '50',
  locale: 'en', acceptedTerms: false,
};

function ageFromBirthDate(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(y, mo - 1, day);
  // Reject impossible calendar dates (e.g. 2000-13-99): the Date constructor
  // rolls them over instead of failing, so verify the round trip.
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== y ||
    d.getMonth() !== mo - 1 ||
    d.getDate() !== day
  ) {
    return null;
  }
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const md = now.getMonth() - d.getMonth();
  if (md < 0 || (md === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

const STEPS = 6;

export default function Register() {
  const { t, locale, setLocale } = useI18n();
  const { signIn } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<Form>({ ...INITIAL, locale });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: keyof Form, v: string | boolean) =>
    setForm((f) => ({ ...f, [k]: v }));

  function validate(s: number): boolean {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = t.register.errorEmail;
      if (form.password.length < 10 || form.password.length > 100)
        e.password = t.register.errorPasswordLength;
    } else if (s === 1) {
      if (!form.firstName.trim()) e.firstName = t.register.errorFirstName;
      const age = ageFromBirthDate(form.birthDate);
      if (age === null) e.birthDate = t.register.errorBirthDate;
      else if (age < 18) e.birthDate = t.register.errorUnderage;
      if (!form.gender.trim()) e.gender = t.register.errorGender;
    } else if (s === 2) {
      if (!form.city.trim()) e.city = t.register.errorCity;
      if (!form.country.trim()) e.country = t.register.errorCountry;
      if (form.phone.trim() && (form.phone.trim().length < 7 || form.phone.trim().length > 24))
        e.phone = t.register.errorPhone;
    } else if (s === 4) {
      const min = Number(form.ageMin), max = Number(form.ageMax), dist = Number(form.distanceMax);
      if (!Number.isInteger(min) || !Number.isInteger(max) || min < 18 || max > 99 || min > max)
        e.ageMin = t.register.errorAgeRange;
      if (!Number.isInteger(dist) || dist < 1 || dist > 500)
        e.distanceMax = t.register.errorDistance;
    } else if (s === 5) {
      if (!form.acceptedTerms) e.acceptedTerms = t.register.errorTerms;
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (validate(step)) {
      setServerError('');
      setStep((s) => Math.min(s + 1, STEPS - 1));
    }
  }

  async function submit() {
    if (!validate(5)) return;
    setLoading(true);
    setServerError('');
    try {
      const { token } = await apiRegister({
        email: form.email.trim(),
        password: form.password,
        firstName: form.firstName.trim(),
        birthDate: form.birthDate.trim(),
        gender: form.gender.trim(),
        city: form.city.trim(),
        ...(form.state.trim() ? { state: form.state.trim() } : {}),
        country: form.country.trim(),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
        locale: form.locale,
        acceptedTerms: true,
      });
      // Seed the extended profile right away (updateprofile needs ALL fields).
      await updateProfile(
        token,
        buildFullProfile({
          firstName: form.firstName.trim(),
          bio: form.bio.trim(),
          city: form.city.trim(),
          state: form.state.trim(),
          country: form.country.trim(),
          gender: form.gender.trim(),
          intention: form.intention.trim(),
          occupation: form.occupation.trim(),
          education: form.education.trim(),
          hobbies: form.hobbies.trim(),
          lifestyle: form.lifestyle.trim(),
          preferredGender: form.preferredGender.trim(),
          ageMin: Number(form.ageMin),
          ageMax: Number(form.ageMax),
          distanceMax: Number(form.distanceMax),
        }),
      );
      await signIn(token);
      router.replace({ pathname: '/(auth)/verify-otp', params: { channel: 'email' } });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setLoading(false);
    }
  }

  const stepTitles = [
    t.register.stepCredentials, t.register.stepPersonal, t.register.stepLocation,
    t.register.stepProfile, t.register.stepPreferences, t.register.stepTerms,
  ];

  return (
    <Screen>
      <Text style={styles.kicker}>{t.register.title}</Text>
      <Text style={styles.stepTitle}>{stepTitles[step]}</Text>
      <View style={styles.dots}>
        {Array.from({ length: STEPS }).map((_, i) => (
          <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
        ))}
      </View>

      {step === 0 && (
        <>
          <TextField label={t.register.email} placeholder={t.register.emailPlaceholder}
            autoCapitalize="none" keyboardType="email-address"
            value={form.email} onChangeText={(v) => set('email', v)} error={errors.email} />
          <TextField label={t.register.password} placeholder={t.register.passwordPlaceholder}
            secureTextEntry value={form.password} onChangeText={(v) => set('password', v)}
            error={errors.password} hint={t.register.passwordHint} />
        </>
      )}
      {step === 1 && (
        <>
          <TextField label={t.register.firstName} placeholder={t.register.firstNamePlaceholder}
            value={form.firstName} onChangeText={(v) => set('firstName', v)} error={errors.firstName} />
          <TextField label={t.register.birthDate} placeholder={t.register.birthDatePlaceholder}
            keyboardType="numbers-and-punctuation"
            value={form.birthDate} onChangeText={(v) => set('birthDate', v)}
            error={errors.birthDate} hint={t.register.birthDateHint} />
          <GenderPicker label={t.register.gender}
            value={form.gender} onChange={(v) => set('gender', v)} error={errors.gender}
            options={[
              { value: 'Hombre', label: t.register.genderMan },
              { value: 'Mujer', label: t.register.genderWoman },
            ]} />
        </>
      )}
      {step === 2 && (
        <>
          <TextField label={t.register.city} placeholder={t.register.cityPlaceholder}
            value={form.city} onChangeText={(v) => set('city', v)} error={errors.city} />
          <TextField label={`${t.register.state} (${t.common.optional})`}
            placeholder={t.register.statePlaceholder}
            value={form.state} onChangeText={(v) => set('state', v)} />
          <TextField label={t.register.country} placeholder={t.register.countryPlaceholder}
            value={form.country} onChangeText={(v) => set('country', v)} error={errors.country} />
          <TextField label={`${t.register.phone} (${t.common.optional})`}
            placeholder={t.register.phonePlaceholder} keyboardType="phone-pad"
            value={form.phone} onChangeText={(v) => set('phone', v)} error={errors.phone} />
        </>
      )}
      {step === 3 && (
        <>
          <TextField label={t.register.bio} placeholder={t.register.bioPlaceholder}
            multiline numberOfLines={3} maxLength={500}
            value={form.bio} onChangeText={(v) => set('bio', v)} />
          <TextField label={t.register.intention} placeholder={t.register.intentionPlaceholder}
            value={form.intention} onChangeText={(v) => set('intention', v)} />
          <TextField label={t.register.occupation} placeholder={t.register.occupationPlaceholder}
            value={form.occupation} onChangeText={(v) => set('occupation', v)} />
          <TextField label={t.register.education} placeholder={t.register.educationPlaceholder}
            value={form.education} onChangeText={(v) => set('education', v)} />
          <TextField label={t.register.hobbies} placeholder={t.register.hobbiesPlaceholder}
            value={form.hobbies} onChangeText={(v) => set('hobbies', v)} />
          <TextField label={t.register.lifestyle} placeholder={t.register.lifestylePlaceholder}
            value={form.lifestyle} onChangeText={(v) => set('lifestyle', v)} />
        </>
      )}
      {step === 4 && (
        <>
          <GenderPicker label={t.register.preferredGender}
            value={form.preferredGender} onChange={(v) => set('preferredGender', v)}
            options={[
              { value: 'Hombre', label: t.register.genderMan },
              { value: 'Mujer', label: t.register.genderWoman },
            ]} />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField label={t.register.ageMin} keyboardType="number-pad"
                value={form.ageMin} onChangeText={(v) => set('ageMin', v)} error={errors.ageMin} />
            </View>
            <View style={styles.half}>
              <TextField label={t.register.ageMax} keyboardType="number-pad"
                value={form.ageMax} onChangeText={(v) => set('ageMax', v)} />
            </View>
          </View>
          <TextField label={t.register.distanceMax} keyboardType="number-pad"
            value={form.distanceMax} onChangeText={(v) => set('distanceMax', v)} error={errors.distanceMax} />
          <Text style={styles.label}>{t.register.language}</Text>
          <View style={styles.row}>
            {(['en', 'es'] as Locale[]).map((l) => (
              <Pressable
                key={l}
                onPress={() => { set('locale', l); setLocale(l); }}
                style={[styles.langBtn, form.locale === l && styles.langBtnActive]}>
                <Text style={[styles.langText, form.locale === l && styles.langTextActive]}>
                  {l === 'en' ? t.register.languageEn : t.register.languageEs}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {step === 5 && (
        <>
          <Text style={styles.termsTitle}>{t.register.termsTitle}</Text>
          <Text style={styles.termsBody}>{t.register.termsBody}</Text>
          <Pressable
            style={styles.checkRow}
            onPress={() => set('acceptedTerms', !form.acceptedTerms)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.acceptedTerms }}>
            <View style={[styles.checkbox, form.acceptedTerms && styles.checkboxOn]}>
              {form.acceptedTerms ? <Text style={styles.checkMark}>✓</Text> : null}
            </View>
            <Text style={styles.checkLabel}>{t.register.acceptTerms}</Text>
          </Pressable>
          {errors.acceptedTerms ? <Text style={styles.fieldError}>{errors.acceptedTerms}</Text> : null}
        </>
      )}

      {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}

      <View style={styles.actions}>
        {step > 0 && (
          <Button title={t.common.back} variant="ghost" onPress={() => setStep((s) => s - 1)} />
        )}
        {step < STEPS - 1 ? (
          <Button title={t.common.next} onPress={next} />
        ) : (
          <Button title={t.register.submit} onPress={submit} loading={loading} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: { fontSize: type.caption, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: colors.inkFaint, marginTop: spacing.md },
  stepTitle: { fontSize: type.title, fontWeight: '800', color: colors.ink, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 6, marginVertical: spacing.md },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: colors.border },
  dotActive: { backgroundColor: colors.rose500 },
  row: { flexDirection: 'row', gap: spacing.md },
  half: { flex: 1 },
  label: { fontSize: type.small, fontWeight: '600', color: colors.ink, marginBottom: spacing.xs },
  langBtn: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: colors.card },
  langBtnActive: { borderColor: colors.rose500, backgroundColor: colors.rose100 },
  langText: { fontSize: type.body, color: colors.inkSoft, fontWeight: '600' },
  langTextActive: { color: colors.rose600, fontWeight: '800' },
  termsTitle: { fontSize: type.subtitle, fontWeight: '700', color: colors.ink, marginBottom: spacing.sm },
  termsBody: { fontSize: type.body, color: colors.inkSoft, lineHeight: 24, marginBottom: spacing.lg },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  checkbox: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: colors.rose500, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkboxOn: { backgroundColor: colors.rose500 },
  checkMark: { color: '#fff', fontWeight: '800' },
  checkLabel: { flex: 1, fontSize: type.body, color: colors.ink, lineHeight: 24 },
  fieldError: { color: colors.danger, fontSize: type.small, marginTop: spacing.xs },
  serverError: { color: colors.danger, fontSize: type.small, marginVertical: spacing.sm, textAlign: 'center' },
  actions: { gap: spacing.xs, marginTop: spacing.lg, marginBottom: spacing.xl },
});
