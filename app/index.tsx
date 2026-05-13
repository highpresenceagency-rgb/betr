import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GhostButton, PrimaryButton } from '../components/Button';
import { colors } from '../constants/theme';

export default function SplashScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.container}>
        {/* Logo block */}
        <View style={styles.logoBlock}>
          <Text style={styles.logo}>
            Bett<Text style={styles.logoAccent}>rr</Text>
          </Text>
          <Text style={styles.tagline}>Bet on yourself</Text>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Buttons */}
        <View style={styles.buttons}>
          <PrimaryButton
            label="Get started"
            onPress={() => router.push('/(auth)/sign-up/step-1')}
          />
          <View style={styles.gap} />
          <GhostButton
            label="Sign in"
            onPress={() => router.push('/(auth)/sign-in')}
          />
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing you agree to our{'\n'}Terms of Service &amp; Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgPage,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logoBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    fontSize: 52,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 56,
  },
  logoAccent: {
    color: colors.accent,
  },
  tagline: {
    fontSize: 11,
    color: '#333333',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  divider: {
    width: 60,
    height: 1,
    backgroundColor: '#2A2A2A',
    marginBottom: 32,
  },
  buttons: {
    width: '100%',
    marginBottom: 24,
  },
  gap: {
    height: 10,
  },
  terms: {
    fontSize: 9,
    color: '#252525',
    textAlign: 'center',
    lineHeight: 16,
  },
});
