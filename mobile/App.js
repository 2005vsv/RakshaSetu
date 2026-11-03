import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { notificationService } from './src/services/notificationService';

export const navigationRef = createNavigationContainerRef();

if (global.ErrorUtils) {
  const defaultHandler = global.ErrorUtils.getGlobalHandler();
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.log('=== GLOBAL_ERROR_STACK ===');
    console.log(error?.name, error?.message);
    console.log(error?.stack);
    console.log('==========================');
    if (defaultHandler) defaultHandler(error, isFatal);
  });
}

export default function App() {
  useEffect(() => {
    notificationService.setNavigationRef(navigationRef);
    notificationService.initialize();
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef}>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
