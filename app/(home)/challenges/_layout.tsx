import { Stack } from 'expo-router';
import { useTheme } from '../../../lib/theme';

export default function ChallengesLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
