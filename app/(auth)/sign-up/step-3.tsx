import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { PrimaryButton } from '../../../components/Button';
import Input from '../../../components/Input';
import Logo from '../../../components/Logo';
import ProgressBar from '../../../components/ProgressBar';
import { signUpStore } from '../../../lib/signUpStore';
import { makeStyles } from '../../../lib/theme';

export default function SignUpStep3() {
  const styles = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const emailValid = email.includes('@') && email.includes('.');
  const passwordValid = password.length >= 8;
  const passwordsMatch = password === confirmPassword;
  const canContinue = emailValid && passwordValid && passwordsMatch;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <BackButton />
        <Logo size="md" />
        <Text style={styles.stepLabel}>Create account · 3 of 4</Text>
        <ProgressBar step={3} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Create your login</Text>
          <Text style={styles.subtitle}>You'll use this to sign in to Bettr.</Text>
        </View>

        <View style={styles.fields}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="jake@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            rightElement={
              emailValid ? <Text style={styles.validBadge}>✓</Text> : null
            }
          />
          <View style={styles.gap} />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Min. 8 characters"
            secureTextEntry={!showPass}
            autoComplete="off"
            textContentType="oneTimeCode"
            autoCorrect={false}
            autoCapitalize="none"
            rightElement={
              <TouchableOpacity onPress={() => setShowPass(v => !v)}>
                <Text style={styles.showBtn}>{showPass ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            }
          />
          <View style={styles.gap} />
          <Input
            label="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter password"
            secureTextEntry={!showPass}
            autoComplete="off"
            textContentType="oneTimeCode"
            autoCorrect={false}
            autoCapitalize="none"
            rightElement={
              confirmPassword.length > 0
                ? <Text style={[styles.validBadge, !passwordsMatch && styles.invalidBadge]}>
                    {passwordsMatch ? '✓' : '✗'}
                  </Text>
                : null
            }
          />
        </View>

        <PrimaryButton
          label="Continue →"
          onPress={() => {
            signUpStore.email = email.trim();
            signUpStore.password = password;
            router.push('/(auth)/sign-up/step-4');
          }}
          disabled={!canContinue}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  stepLabel: {
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 14,
  },
  titleBlock: {
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  fields: { marginBottom: 24 },
  gap: { height: 10 },
  showBtn: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  validBadge: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  invalidBadge: { color: colors.red },
}));
