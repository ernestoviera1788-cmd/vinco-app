import { useEffect } from 'react';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../src/i18n';
import { useAuth } from '../../src/auth/AuthContext';
import {
  refreshUnreadMessages,
  subscribeToNewUnreadMessages,
  useUnreadMessages,
} from '../../src/notifications/unread';
import { playMessageSound } from '../../src/notifications/sound';
import { colors } from '../../src/theme';

/** How often unread messages are re-checked while the tabs are mounted. */
const UNREAD_POLL_MS = 15000;

function MessagesIcon({ color, size, hasUnread }: { color: ColorValue; size: number; hasUnread: boolean }) {
  return (
    <View style={{ width: size, height: size }}>
      <Ionicons name="chatbubble-outline" size={size} color={color} />
      {hasUnread ? <View style={styles.dot} /> : null}
    </View>
  );
}

export default function TabsLayout() {
  const { t } = useI18n();
  const { token } = useAuth();
  const pathname = usePathname();
  const unreadMessages = useUnreadMessages();
  const isChatOpen = pathname.startsWith('/chat/');

  useEffect(() => {
    if (!token) return;
    let alive = true;
    const unsubscribe = subscribeToNewUnreadMessages(() => {
      // The open chat has its own message-level detector. Avoid playing the
      // same incoming message twice while the tab layout remains mounted.
      if (alive && !isChatOpen) void playMessageSound();
    });
    const check = async () => {
      await refreshUnreadMessages(token);
    };
    void check();
    const timer = setInterval(() => void check(), UNREAD_POLL_MS);
    return () => {
      alive = false;
      unsubscribe();
      clearInterval(timer);
    };
  }, [token, isChatOpen]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.rose600,
        tabBarInactiveTintColor: colors.inkFaint,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      }}>
      <Tabs.Screen
        name="discover"
        options={{
          title: t.tabs.discover,
          tabBarIcon: ({ color, size }) => <Ionicons name="compass-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: t.tabs.likes,
          tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: t.tabs.matches,
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t.tabs.messages,
          tabBarIcon: ({ color, size }) => (
            <MessagesIcon color={color} size={size} hasUnread={unreadMessages > 0} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t.tabs.profile,
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dot: {
    position: 'absolute',
    top: -2,
    right: -4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.rose600,
    borderWidth: 1.5,
    borderColor: colors.card,
  },
});
