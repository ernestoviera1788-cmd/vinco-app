import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { useI18n } from '../src/i18n';
import { getMe, listDiscovery } from '../src/api/actions';
import { Screen } from '../src/components/Screen';
import { Button } from '../src/components/Button';
import { colors, spacing, type } from '../src/theme';

interface DiagData {
  userId: string;
  email: string;
  gender: string;
  status: string;
  preferredGender: string;
  ageMin: string;
  ageMax: string;
  profileVisible: string;
  discoveryCount: number;
  discoveryNames: string;
  discoveryIds: string;
  error: string;
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{k}</Text>
      <Text style={[styles.val, bad ? styles.bad : null]}>{v}</Text>
    </View>
  );
}

export default function DiagnosticScreen() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [data, setData] = useState<DiagData | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const me = await getMe(token);
      const cards = await listDiscovery(token);
      const prefGender = me.profile?.preferredGender ?? '(vacío)';
      const gender = me.user.gender ?? '(vacío)';
      // Detecta el problema conocido: mayúsculas/minúsculas.
      const genderBad = gender !== 'Hombre' && gender !== 'Mujer' && gender !== '(vacío)';
      const prefBad = prefGender !== 'Hombre' && prefGender !== 'Mujer' && prefGender !== '(vacío)';
      setData({
        userId: me.user.id,
        email: me.user.email ?? '(sin email)',
        gender: `${gender}${genderBad ? ' ⚠️ VALOR SOSPECHOSO' : ''}`,
        status: 'active (asumido si getme funciona)',
        preferredGender: `${prefGender}${prefBad ? ' ⚠️ VALOR SOSPECHOSO' : ''}`,
        ageMin: String(me.profile?.ageMin ?? '?'),
        ageMax: String(me.profile?.ageMax ?? '?'),
        profileVisible: String(me.privacy?.profileVisible ?? '?'),
        discoveryCount: cards.length,
        discoveryNames: cards.map((c) => `${c.firstName} (${c.age})`).join(', ') || '(ninguno)',
        discoveryIds: cards.map((c) => c.id.slice(0, 8)).join(', ') || '(ninguno)',
        error: '',
      });
    } catch (e) {
      setData({
        userId: '(error)', email: '', gender: '', status: '', preferredGender: '',
        ageMin: '', ageMax: '', profileVisible: '',
        discoveryCount: -1, discoveryNames: '', discoveryIds: '',
        error: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(useCallback(() => { void run(); }, [run]));

  return (
    <Screen>
      <Text style={styles.title}>Diagnóstico</Text>
      {loading ? (
        <Text style={styles.dim}>{t.common.loading}</Text>
      ) : data ? (
        <ScrollView>
          {data.error ? <Text style={styles.bad}>Error: {data.error}</Text> : null}
          <Text style={styles.section}>USUARIO ACTUAL</Text>
          <Row k="auth user_id" v={data.userId} />
          <Row k="email" v={data.email} />
          <Row k="género" v={data.gender} bad={data.gender.includes('⚠️')} />
          <Row k="me interesa" v={data.preferredGender} bad={data.preferredGender.includes('⚠️')} />
          <Row k="edad min/max" v={`${data.ageMin} – ${data.ageMax}`} />
          <Row k="perfil visible" v={data.profileVisible} />
          <Text style={styles.section}>DISCOVERY (misma consulta que la app)</Text>
          <Row k="endpoint" v="POST /actions {action:listdiscovery}" />
          <Row k="perfiles recibidos" v={String(data.discoveryCount)} bad={data.discoveryCount === 0} />
          <Row k="nombres" v={data.discoveryNames} />
          <Row k="ids" v={data.discoveryIds} />
          <Text style={styles.section}>CONCLUSIÓN</Text>
          <Text style={styles.conclusion}>
            {data.discoveryCount > 0
              ? `✅ El backend devuelve ${data.discoveryCount} perfil(es). Si Descubrir muestra 0, el problema está en el frontend.`
              : data.discoveryCount === 0
                ? '❌ El backend devuelve 0 perfiles. Revisa "me interesa" (debe ser exactamente "Mujer" o "Hombre") y el rango de edad.'
                : 'Error al consultar.'}
          </Text>
          <View style={styles.btn}>
            <Button title="Re-ejecutar diagnóstico" onPress={() => void run()} />
          </View>
        </ScrollView>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, marginBottom: spacing.md },
  section: { fontSize: type.small, fontWeight: '700', color: colors.rose600, marginTop: spacing.lg, marginBottom: spacing.xs },
  row: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  key: { flex: 1, fontSize: type.small, color: colors.inkSoft, fontWeight: '600' },
  val: { flex: 2, fontSize: type.small, color: colors.ink },
  bad: { color: colors.danger, fontWeight: '700' },
  dim: { color: colors.inkFaint },
  conclusion: { fontSize: type.body, color: colors.ink, marginTop: spacing.sm, lineHeight: 22 },
  btn: { marginTop: spacing.lg, marginBottom: spacing.xl },
});
