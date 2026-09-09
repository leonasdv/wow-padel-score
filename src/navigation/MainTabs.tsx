import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen } from '../screens/HomeScreen';
import { PlayersScreen } from '../screens/PlayersScreen';
import { ResultsScreen } from '../screens/ResultsScreen';
import { SupportScreen } from '../screens/SupportScreen';
import { useTheme } from '../theme/ThemeContext';
import type { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

export function MainTabs() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 12);
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.surfaceSunken,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          height: 62 + bottomInset,
          paddingTop: 10,
          paddingBottom: bottomInset,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Events"
        component={HomeScreen}
        options={{ tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Players"
        component={PlayersScreen}
        options={{ tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'people' : 'people-outline'} size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Results"
        component={ResultsScreen}
        options={{ tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'trophy' : 'trophy-outline'} size={22} color={color} /> }}
      />
      <Tab.Screen
        name="Support"
        component={SupportScreen}
        options={{ tabBarIcon: ({ color, focused }) => <Ionicons name={focused ? 'heart' : 'heart-outline'} size={22} color={color} /> }}
      />
    </Tab.Navigator>
  );
}
