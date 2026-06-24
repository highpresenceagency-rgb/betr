import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../components/Button';
import Input from '../../components/Input';
import Logo from '../../components/Logo';
import { supabase } from '../../lib/supabase';
import { makeStyles } from '../../lib/theme';

export default function SignInScreen() {
  const styles = useStyles();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
      return;
    }
    router.replace('/(home)/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.welcome}>Welcome back</Text>
          <Logo size="lg" />
        </View>

        {/* Fields */}
        <View style={styles.fields}>
          <Input
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="jake@bettrr.app"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <View style={styles.gap} />
          <Input
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            secureTextEntry={!showPass}
            autoComplete="current-password"
            textContentType="password"
            autoCorrect={false}
            autoCapitalize="none"
            rightElement={
              <TouchableOpacity onPress={() => setShowPass(v => !v)}>
                <Text style={styles.showBtn}>{showPass ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            }
          />
        </View>

        {/* Sign in button */}
        <PrimaryButton label="Sign in" onPress={handleSignIn} loading={loading} />
        <TouchableOpacity
          style={styles.forgotWrap}
          onPress={async () => {
            if (!email.trim()) {
              Alert.alert('Enter your email first', 'Type your email above, then tap "Forgot password?".');
              return;
            }
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
            if (error) {
              Alert.alert('Error', error.message);
            } else {
              Alert.alert('Check your email', `A password reset link has been sent to ${email.trim()}.`);
            }
          }}
        >
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>

        {/* Sign up link */}
        <View style={styles.signupRow}>
          <Text style={styles.signupText}>Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up/step-1')}>
            <Text style={styles.signupLink}>Get started</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
  },
  welcome: {
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fields: {
    marginBottom: 16,
  },
  gap: { height: 10 },
  showBtn: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  forgotWrap: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  forgot: {
    color: colors.textMuted,
    fontSize: 12,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  signupText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  signupLink: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
}));
