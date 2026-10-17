import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useI18n } from '../src/i18n';
import { useAuth } from '../src/auth/AuthContext';
import {
  cancelSubscription,
  confirmCheckout,
  createCheckout,
  listBoosts,
  listMyBilling,
  listPlans,
  renewSubscription,
  requestRefund,
  type BillingInfo,
} from '../src/api/actions';
import { ApiError } from '../src/api/client';
import type { BoostProduct, Plan } from '../src/api/types';
import { Screen } from '../src/components/Screen';
import { Button } from '../src/components/Button';
import { TextField } from '../src/components/TextField';
import { StubBanner } from '../src/components/StubBanner';
import { SectionTitle } from '../src/components/Rows';
import { colors, radius, spacing, type } from '../src/theme';

/**
 * Premium & commerce. Purchases use the REAL Stripe web checkout:
 * `createcheckout` → system browser → `confirmcheckout`.
 * Native Apple/Google in-app purchases are NOT wired (stub banner, no fake).
 */
export default function Premium() {
  const { t } = useI18n();
  const { token } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [boosts, setBoosts] = useState<BoostProduct[]>([]);
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [refundFor, setRefundFor] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [p, b] = await Promise.all([listPlans(), listBoosts()]);
      setPlans(p);
      setBoosts(b);
      if (token) setBilling(await listMyBilling(token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setLoading(false);
    }
  }, [token, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function buy(kind: 'SUBSCRIPTION' | 'BOOST', itemId: string) {
    if (!token) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const { checkoutUrl, sessionId } = await createCheckout(token, kind, itemId);
      if (!checkoutUrl) throw new ApiError(t.errors.unknown);
      Alert.alert(t.premium.checkoutTitle, t.premium.checkoutBody, [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.premium.openCheckout,
          onPress: () => void (async () => {
            await WebBrowser.openBrowserAsync(checkoutUrl);
            // After returning from the browser, the user confirms manually.
            Alert.alert(t.premium.checkoutTitle, t.premium.confirmAfter, [
              { text: t.common.cancel, style: 'cancel' },
              {
                text: t.common.confirm,
                onPress: () => void (async () => {
                  if (!sessionId) return;
                  try {
                    await confirmCheckout(token, sessionId);
                    setNotice(t.premium.confirmed);
                    setBilling(await listMyBilling(token));
                  } catch (e) {
                    setError(e instanceof ApiError ? e.message : t.premium.confirmError);
                  }
                })(),
              },
            ]);
          })(),
        },
      ]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!token || !billing?.subscription) return;
    Alert.alert(t.premium.cancelTitle, t.premium.cancelBody, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.premium.cancel, style: 'destructive',
        onPress: () => void (async () => {
          try {
            await cancelSubscription(token, billing.subscription?.id ?? '');
            setNotice(t.premium.cancelled);
            setBilling(await listMyBilling(token));
          } catch (e) {
            setError(e instanceof ApiError ? e.message : t.errors.unknown);
          }
        })(),
      },
    ]);
  }

  async function renew() {
    if (!token || !billing?.subscription) return;
    try {
      await renewSubscription(token, billing.subscription.id);
      setNotice(t.premium.renewed);
      setBilling(await listMyBilling(token));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    }
  }

  async function sendRefund(paymentId: string) {
    if (!token) return;
    if (refundReason.trim().length < 8 || refundReason.trim().length > 500) {
      setError(t.premium.errorReason);
      return;
    }
    try {
      await requestRefund(token, paymentId, refundReason.trim());
      setNotice(t.premium.refundSent);
      setRefundFor(null);
      setRefundReason('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t.errors.unknown);
    }
  }

  const sub = billing?.subscription;

  return (
    <Screen>
      <Text style={styles.title}>{t.premium.title}</Text>
      <Text style={styles.subtitle}>{t.premium.subtitle}</Text>
      <StubBanner title={t.premium.iapTitle} body={t.premium.iapBody} />
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <Text style={styles.dim}>{t.common.loading}</Text>
      ) : (
        <>
          <SectionTitle>{t.premium.subscription}</SectionTitle>
          {sub ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{sub.planName ?? '—'}</Text>
              <Text style={styles.dim}>{t.premium.status}: {sub.status ?? '—'}</Text>
              {sub.renewsAt ? <Text style={styles.dim}>{t.premium.renewsAt}: {sub.renewsAt}</Text> : null}
              <View style={styles.row}>
                <Button title={t.premium.renew} variant="secondary" onPress={() => void renew()} />
                <Button title={t.premium.cancel} variant="ghost" onPress={() => void cancel()} />
              </View>
            </View>
          ) : (
            <Text style={styles.dim}>{t.premium.noSubscription}</Text>
          )}

          <SectionTitle>{t.premium.plans}</SectionTitle>
          {plans.map((p) => (
            <View key={p.id} style={styles.card}>
              <Text style={styles.cardTitle}>{p.name}</Text>
              <Text style={styles.dim}>
                {[p.interval, typeof p.price === 'number' ? `${p.price} ${p.currency ?? ''}`.trim() : ''].filter(Boolean).join(' · ')}
              </Text>
              {p.benefits?.map((b, i) => (
                <Text key={i} style={styles.benefit}>✓ {b}</Text>
              ))}
              <Button title={t.premium.choosePlan} onPress={() => void buy('SUBSCRIPTION', p.id)} loading={busy} style={styles.buyBtn} />
            </View>
          ))}

          <SectionTitle>{t.premium.boosts}</SectionTitle>
          {boosts.map((b) => (
            <View key={b.id} style={styles.card}>
              <Text style={styles.cardTitle}>{b.name}</Text>
              {b.description ? <Text style={styles.dim}>{b.description}</Text> : null}
              {typeof b.price === 'number' ? <Text style={styles.price}>{b.price} {b.currency ?? ''}</Text> : null}
              <Button title={t.premium.buyBoost} variant="secondary" onPress={() => void buy('BOOST', b.id)} loading={busy} style={styles.buyBtn} />
            </View>
          ))}

          <SectionTitle>{t.premium.payments}</SectionTitle>
          {(billing?.payments ?? []).map((pay) => (
            <View key={pay.id} style={styles.card}>
              <Text style={styles.cardTitle}>
                {typeof pay.amount === 'number' ? `${pay.amount} ${pay.currency ?? ''}` : pay.id}
              </Text>
              <Text style={styles.dim}>{pay.status ?? ''} {pay.createdAt ? `· ${pay.createdAt}` : ''}</Text>
              {refundFor === pay.id ? (
                <View style={styles.refundBox}>
                  <TextField
                    label={t.premium.refundReason}
                    placeholder={t.premium.refundReasonPlaceholder}
                    multiline
                    value={refundReason}
                    onChangeText={setRefundReason}
                  />
                  <Button title={t.premium.refund} onPress={() => void sendRefund(pay.id)} />
                </View>
              ) : (
                <Button title={t.premium.refund} variant="ghost" onPress={() => setRefundFor(pay.id)} />
              )}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: '900', color: colors.ink },
  subtitle: { fontSize: type.body, color: colors.inkSoft, marginTop: 4 },
  notice: { color: colors.success, fontSize: type.small, marginTop: spacing.sm },
  error: { color: colors.danger, fontSize: type.small, marginTop: spacing.sm },
  dim: { fontSize: type.small, color: colors.inkFaint, marginTop: 2 },
  card: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, marginTop: spacing.sm },
  cardTitle: { fontSize: type.body, fontWeight: '800', color: colors.ink },
  benefit: { fontSize: type.small, color: colors.inkSoft, marginTop: 4 },
  price: { fontSize: type.subtitle, fontWeight: '800', color: colors.rose600, marginTop: spacing.xs },
  buyBtn: { marginTop: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  refundBox: { marginTop: spacing.sm },
});
