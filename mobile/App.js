import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import HomeScreen from './screens/HomeScreen';
import MonthlyHabitsScreen from './screens/MonthlyHabitsScreen';
import EditHabitsScreen from './screens/EditHabitsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#FAF4BD' },
          headerTintColor: '#E87C3A',
          headerTitleStyle: { fontWeight: 'bold', fontSize: 22 },
          tabBarActiveTintColor: '#E87C3A',
          tabBarInactiveTintColor: '#BE7961',
          tabBarStyle: { backgroundColor: '#FAF4BD', borderTopColor: '#F3C248', borderTopWidth: 1 },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            title: 'Arise',
            tabBarLabel: 'Home',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏠</Text>,
          }}
        />
        <Tab.Screen
          name="Monthly"
          component={MonthlyHabitsScreen}
          options={{
            title: 'Monthly Habits',
            tabBarLabel: 'Monthly',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📅</Text>,
          }}
        />
        <Tab.Screen
          name="Edit"
          component={EditHabitsScreen}
          options={{
            title: 'Edit Habits',
            tabBarLabel: 'Edit',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>✏️</Text>,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
