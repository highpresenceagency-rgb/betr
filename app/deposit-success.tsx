import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { makeStyles } from '../lib/theme';

export default function DepositSuccessScreen() {
  const styles = useStyles();
  useEffect(() => {
    // Brief pause so the user sees confirmation, then go to wallet
    const timer = setTimeout(() => router.replace('/(home)/wallet/'), 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.center}>
        <View style={styles.ring}>
          <Text style={styles.icon}>✓</Text>
        </View>
        <Text style={styles.title}>Deposit successful</Text>
        <Text style={styles.sub}>Funds will appear in your wallet shortly.</Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  ring: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', marginBottom: 20,
    borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
    borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB,
  },
  icon: { fontSize: 28, color: colors.accent, fontWeight: '800' },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  sub: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
}));
