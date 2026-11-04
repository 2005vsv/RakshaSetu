import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../theme/colors';

// Screens
import DashboardScreen from '../screens/dashboard/DashboardScreen';
import SosScreen from '../screens/sos/SosScreen';
import SafetyMapScreen from '../screens/map/SafetyMapScreen';
import DigitalIdScreen from '../screens/id/DigitalIdScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import TripsScreen from '../screens/trips/TripsScreen';
import AlertsScreen from '../screens/alerts/AlertsScreen';
import SupportScreen from '../screens/support/SupportScreen';
import EmergencyPhrasebookScreen from '../screens/phrasebook/EmergencyPhrasebookScreen';
import AiAssistantScreen from '../screens/chat/AiAssistantScreen';
import InAppNavigationScreen from '../screens/navigation/InAppNavigationScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardMain" component={DashboardScreen} />
      <Stack.Screen name="TripsTab" component={TripsScreen} />
      <Stack.Screen name="AlertsTab" component={AlertsScreen} />
      <Stack.Screen name="SupportScreen" component={SupportScreen} />
      <Stack.Screen name="EmergencyPhrasebook" component={EmergencyPhrasebookScreen} />
      <Stack.Screen name="AiAssistant" component={AiAssistantScreen} />
      <Stack.Screen name="InAppNavigation" component={InAppNavigationScreen} />
    </Stack.Navigator>
  );
}

export default function AppTabs() {
  const insets = useSafeAreaInsets();
  const safeBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 14 : 8);
  const barHeight = (Platform.OS === 'ios' ? 62 : 64) + safeBottom;

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: [
          styles.tabBar,
          {
            height: barHeight,
            paddingBottom: safeBottom,
          },
        ],
        tabBarHideOnKeyboard: true,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardStack}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="MapTab"
        component={SafetyMapScreen}
        options={{
          tabBarLabel: 'Radar',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'map' : 'map-outline'} size={22} color={color} />
          ),
        }}
      />

      {/* Prominent High-Contrast Central SOS Tab */}
      <Tab.Screen
        name="SosTab"
        component={SosScreen}
        options={{
          tabBarLabel: 'SOS',
          tabBarLabelStyle: [styles.tabLabel, { color: Colors.danger, fontWeight: '800' }],
          tabBarIcon: () => (
            <View style={styles.centralSosButton}>
              <Ionicons name="warning" size={26} color={Colors.white} />
            </View>
          ),
        }}
      />

      <Tab.Screen
        name="IdTab"
        component={DigitalIdScreen}
        options={{
          tabBarLabel: 'ID Pass',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'qr-code' : 'qr-code-outline'} size={22} color={color} />
          ),
        }}
      />

      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 85 : 65,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 8,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '700',
  },
  centralSosButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 8 : 10,
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 2.5,
    borderColor: Colors.surface,
  },
});

