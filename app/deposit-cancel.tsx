import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeStyles } from '../lib/theme';

export default function DepositCancelScreen() {
  const styles = useStyles();
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/(home)/wallet/'), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.center}>
        <Text style={styles.icon}>✕</Text>
        <Text style={styles.title}>Deposit cancelled</Text>
        <Text style={styles.sub}>No charge was made.</Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  icon: { fontSize: 36, color: colors.textDim, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  sub: { fontSize: 13, color: colors.textMuted },
}));
