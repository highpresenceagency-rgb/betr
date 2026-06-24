import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GhostButton, PrimaryButton } from '../components/Button';
import { enterGuestMode } from '../lib/guest';
import { makeStyles } from '../lib/theme';

const FEATURES = [
  { icon: '🎯', title: 'Pick a goal', sub: 'Any habit or workout — you set the bar.' },
  { icon: '🎥', title: 'Prove it daily', sub: 'Record in-app video. AI + your group keep it honest.' },
  { icon: '🏆', title: 'Split the pot', sub: 'Finish and share the stakes of those who didn’t.' },
];

export default function SplashScreen() {
  const styles = useStyles();
  const continueAsGuest = async () => {
    await enterGuestMode();
    router.replace('/(home)/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.container}>
        {/* Logo block */}
        <View style={styles.logoBlock}>
          <Image source={require('../assets/logo.png')} style={styles.logoMark} />
          <Text style={styles.logo}>
            Bett<Text style={styles.logoAccent}>rr</Text>
          </Text>
          <Text style={styles.tagline}>Bet on yourself</Text>
        </View>

        {/* How it works */}
        <View style={styles.features}>
          {FEATURES.map((f) => (
            <View key={f.title} style={styles.feature}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureSub}>{f.sub}</Text>
              </View>
            </View>
          ))}
        </View>

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
          <TouchableOpacity
            onPress={continueAsGuest}
            style={styles.guestWrap}
            activeOpacity={0.7}
          >
            <Text style={styles.guestText}>Continue as guest</Text>
          </TouchableOpacity>
        </View>

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing you agree to our{'\n'}Terms of Service &amp; Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
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
    marginBottom: 28,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: 18,
    marginBottom: 16,
  },
  logo: {
    fontSize: 48,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -2,
    lineHeight: 52,
  },
  logoAccent: {
    color: colors.accent,
  },
  tagline: {
    fontSize: 11,
    color: colors.textDim,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: 8,
  },
  features: {
    width: '100%',
    gap: 14,
    marginBottom: 32,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  featureIcon: {
    fontSize: 24,
    width: 40,
    height: 40,
    textAlign: 'center',
    lineHeight: 40,
    backgroundColor: colors.accentDark,
    borderRadius: 12,
    overflow: 'hidden',
  },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  featureSub: { fontSize: 12, color: colors.textDim, marginTop: 1, lineHeight: 16 },
  buttons: {
    width: '100%',
    marginBottom: 20,
  },
  gap: {
    height: 10,
  },
  guestWrap: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  guestText: {
    fontSize: 12,
    color: colors.textDim,
    letterSpacing: 0.3,
  },
  terms: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 16,
  },
}));
