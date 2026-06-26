import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, StyleSheet } from 'react-native';
import InboxScreen from '../screens/InboxScreen';
import FoldersScreen from '../screens/FoldersScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { colors } from '../lib/colors';

const Tab = createBottomTabNavigator();

type IoniconName = keyof typeof Ionicons.glyphMap;

const TAB_CONFIG: Record<string, { active: IoniconName; inactive: IoniconName; label: string }> = {
  Inbox:       { active: 'mail',         inactive: 'mail-outline',      label: 'Mail'     },
  Folders:     { active: 'folder',       inactive: 'folder-outline',    label: 'Folders'  },
  SettingsTab: { active: 'settings',     inactive: 'settings-outline',  label: 'Settings' },
};

export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => {
        const cfg = TAB_CONFIG[route.name];
        return {
          headerShown: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textFaint,
          tabBarLabelStyle: styles.tabLabel,
          tabBarShowLabel: true,
          tabBarIcon: ({ color, focused }) => (
            <View style={styles.iconWrap}>
              {focused && <View style={styles.activeIndicator} />}
              <Ionicons
                name={focused ? cfg?.active : cfg?.inactive ?? 'ellipse-outline'}
                size={24}
                color={color}
              />
            </View>
          ),
          tabBarLabel: cfg?.label ?? route.name,
        };
      }}
    >
      {/* Mail tab — handles mail+search internally with its own bottom bar (matches website BottomTabBar) */}
      <Tab.Screen
        name="Inbox"
        component={InboxScreen}
        options={{ tabBarStyle: { display: 'none' } }}
      />

      {/* Folders tab — mirrors EmailSidebar folder navigation */}
      <Tab.Screen name="Folders" component={FoldersScreen} />

      {/* Settings tab */}
      <Tab.Screen name="SettingsTab" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.bgCard,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 82 : 62,
    paddingBottom: Platform.OS === 'ios' ? 22 : 8,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  tabLabel: { fontSize: 10, fontWeight: '600', marginTop: 2 },
  iconWrap: { alignItems: 'center', position: 'relative' },
  activeIndicator: {
    position: 'absolute',
    top: -10,
    width: 36,
    height: 3,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
});
