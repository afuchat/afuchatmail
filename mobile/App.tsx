import 'react-native-url-polyfill/auto';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import AuthScreen from './src/screens/AuthScreen';
import MainTabs from './src/navigation/MainTabs';
import EmailDetailScreen from './src/screens/EmailDetailScreen';
import ComposeScreen from './src/screens/ComposeScreen';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#0f172a',
    card: '#1e293b',
    text: '#f1f5f9',
    border: '#334155',
    primary: '#2563eb',
    notification: '#2563eb',
  },
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={styles.splash}>
        <View style={styles.splashIcon}>
          <Text style={styles.splashEmoji}>✉️</Text>
        </View>
        <Text style={styles.splashTitle}>AfuMail</Text>
        <ActivityIndicator color="#2563eb" style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer theme={navTheme}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!session ? (
            <Stack.Screen name="Auth" component={AuthScreen} />
          ) : (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen
                name="EmailDetail"
                component={EmailDetailScreen}
                options={{ animation: 'slide_from_right' }}
              />
              <Stack.Screen
                name="Compose"
                component={ComposeScreen}
                options={{ animation: 'slide_from_bottom', presentation: 'modal' }}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  splashIcon: {
    width: 80, height: 80, borderRadius: 20,
    backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  splashEmoji: { fontSize: 36 },
  splashTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '700' },
});
