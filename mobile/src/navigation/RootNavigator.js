import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import Colors from '../theme/colors';

import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import AppTabs from './AppTabs';
import EmergencyPhrasebookScreen from '../screens/phrasebook/EmergencyPhrasebookScreen';
import AiAssistantScreen from '../screens/chat/AiAssistantScreen';
import InAppNavigationScreen from '../screens/navigation/InAppNavigationScreen';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="App" component={AppTabs} />
          <Stack.Screen name="EmergencyPhrasebook" component={EmergencyPhrasebookScreen} />
          <Stack.Screen name="AiAssistant" component={AiAssistantScreen} />
          <Stack.Screen name="InAppNavigation" component={InAppNavigationScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

