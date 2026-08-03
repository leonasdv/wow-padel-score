import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { CreateCourtsScreen } from '../screens/create/CreateCourtsScreen';
import { CreateFormatScreen } from '../screens/create/CreateFormatScreen';
import { CreateNameScreen } from '../screens/create/CreateNameScreen';
import { CreatePlayersScreen } from '../screens/create/CreatePlayersScreen';
import { CreateScoringScreen } from '../screens/create/CreateScoringScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EditEventScreen } from '../screens/EditEventScreen';
import { KnockoutScreen } from '../screens/KnockoutScreen';
import { ResultCardScreen } from '../screens/ResultCardScreen';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="CreateName" component={CreateNameScreen} />
      <Stack.Screen name="CreateFormat" component={CreateFormatScreen} />
      <Stack.Screen name="CreateScoring" component={CreateScoringScreen} />
      <Stack.Screen name="CreateCourts" component={CreateCourtsScreen} />
      <Stack.Screen name="CreatePlayers" component={CreatePlayersScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="Knockout" component={KnockoutScreen} />
      <Stack.Screen name="EditEvent" component={EditEventScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ResultCard" component={ResultCardScreen} />
    </Stack.Navigator>
  );
}
