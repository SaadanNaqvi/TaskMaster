import React from 'react';
import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { colors } from '../../theme/colors';
import { font } from '../../theme/typography';
import { TrainIcon, HistoryIcon, FormMapIcon, ProfileIcon } from '../../components/icons/TabIcons';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.lime,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: 'rgba(14,16,20,0.97)',
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.select({ ios: 86, default: 64 }),
          paddingTop: 10,
        },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 10.5 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Train',
          tabBarIcon: ({ color }) => <TrainIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => <HistoryIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="form-map"
        options={{
          title: 'Form Map',
          tabBarIcon: ({ color }) => <FormMapIcon color={String(color)} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <ProfileIcon color={String(color)} />,
        }}
      />
    </Tabs>
  );
}

