import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { useI18n } from '../src/i18n';
import { colors, type } from '../src/theme';

/**
 * Splash: subtle romantic animation (breathing heart), then auto-continues
 * to the auth stack or the main tabs once the session check is done.
 */
export default function Splash() {
  const { ready, token } = useAuth();
  const { t } = useI18n();
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    breathe.start();
    const timer = setTimeout(() => setMinTimeElapsed(true), 1800);
    return () => {
      breathe.stop();
      clearTimeout(timer);
    };
  }, [opacity, scale]);

  useEffect(() => {
    if (minTimeElapsed && ready) {
      router.replace(token ? '/(tabs)/discover' : '/(auth)/welcome');
    }
  }, [minTimeElapsed, ready, token]);

  return (
    <View style={styles.root} accessibilityLabel={t.splash.accessibilityLabel}>
      <Animated.View style={[styles.heart, { transform: [{ scale }], opacity }]}>
        <Image source={require('../assets/splash-icon.png')} style={styles.image} />
      </Animated.View>
      <Animated.Text style={[styles.wordmark, { opacity }]}>{t.common.appName}</Animated.Text>
      <Animated.Text style={[styles.tagline, { opacity }]}>{t.common.tagline}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.plum900,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  heart: { marginBottom: 24 },
  image: { width: 140, height: 140 },
  wordmark: {
    fontSize: 44,
    fontWeight: '900',
    color: colors.onDark,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: type.body,
    color: colors.rose100,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
});
