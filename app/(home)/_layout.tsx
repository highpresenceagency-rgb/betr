import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../lib/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

function tabIcon(focused: boolean, activeIcon: IoniconsName, inactiveIcon: IoniconsName, color: string) {
  return <Ionicons name={focused ? activeIcon : inactiveIcon} size={22} color={color} />;
}

export default function HomeLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.borderLight,
          borderTopWidth: 1,
          height: 72 + insets.bottom,
          paddingBottom: 14 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2 },
        tabBarIconStyle: { marginBottom: 0 },
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
