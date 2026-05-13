import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';

export default function DepositCancelScreen() {
  useEffect(() => {
    const timer = setTimeout(() => router.replace('/(home)/wallet/'), 1500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Text style={styles.icon}>✕</Text>
        <Text style={styles.title}>Deposit cancelled</Text>
        <Text style={styles.sub}>No charge was made.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  icon: { fontSize: 36, color: '#555', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  sub: { fontSize: 13, color: colors.textMuted },
});
