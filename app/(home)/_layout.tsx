import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { colors } from '../../constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(focused: boolean, activeIcon: IoniconsName, inactiveIcon: IoniconsName, color: string) {
  return <Ionicons name={focused ? activeIcon : inactiveIcon} size={22} color={color} />;
}

export default function HomeLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0E0E0E',
          borderTopColor: colors.borderLight,
          borderTopWidth: 1.5,
          height: 64,
          paddingBottom: 10,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'grid', 'grid-outline', color) }} />
      <Tabs.Screen name="challenges" options={{ title: 'Challenges', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'trophy', 'trophy-outline', color) }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'people', 'people-outline', color) }} />
      <Tabs.Screen name="wallet" options={{ title: 'Wallet', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'wallet', 'wallet-outline', color) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ focused, color }) => tabIcon(focused, 'person-circle', 'person-circle-outline', color) }} />
    </Tabs>
  );
}
