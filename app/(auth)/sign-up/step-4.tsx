import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { PrimaryButton } from '../../../components/Button';
import Logo from '../../../components/Logo';
import ProgressBar from '../../../components/ProgressBar';
import { radii } from '../../../constants/theme';
import { signUpStore } from '../../../lib/signUpStore';
import { supabase } from '../../../lib/supabase';
import { makeStyles } from '../../../lib/theme';

export default function SignUpStep4() {
  const styles = useStyles();
  const [loading, setLoading] = useState(false);
  const { firstName, lastName, username, email } = signUpStore;
  const displayName = lastName ? `${firstName} ${lastName}` : firstName;

  const handleFinish = async () => {
    setLoading(true);
    const { password } = signUpStore;
    const initials = (firstName[0] ?? '') + (lastName[0] ?? firstName[1] ?? '');

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { name: displayName, username, initials: initials.toUpperCase() },
      },
    });

    setLoading(false);

    if (error) {
      signUpStore.password = '';
      const msg = error.message.includes('username')
        ? 'That username is already taken. Go back and choose a different one.'
        : error.message;
      Alert.alert('Sign up failed', msg);
      return;
    }

    // Clear sensitive fields from in-memory store
    signUpStore.password = '';
    signUpStore.email = '';

    // If email confirmation is required, session will be null until confirmed
    if (!data.session) {
      Alert.alert(
        'Check your email',
        `A confirmation link has been sent to ${email}. Click it to activate your account, then sign in.`,
        [{ text: 'OK', onPress: () => router.replace('/') }],
      );
      return;
    }

    router.replace('/(home)/');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <BackButton />
        <Logo size="md" />
        <Text style={styles.stepLabel}>Create account · 4 of 4</Text>
        <ProgressBar step={4} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>You're all set</Text>
          <Text style={styles.subtitle}>Review your details before creating your account.</Text>
        </View>

        {/* Review card */}
        <View style={styles.reviewCard}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>NAME</Text>
            <Text style={styles.reviewVal}>{displayName}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>USERNAME</Text>
            <Text style={styles.reviewVal}>{username}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>EMAIL</Text>
            <Text style={styles.reviewVal}>{email}</Text>
          </View>
        </View>

        {/* Wallet note */}
        <View style={styles.walletNote}>
          <Text style={styles.walletNoteTitle}>💳  Add your bank after sign up</Text>
          <Text style={styles.walletNoteText}>
            Connect a bank or debit card from the Wallet tab to deposit funds and join challenges. You can sign up now and add payment later.
          </Text>
        </View>

        <View style={{ flex: 1, minHeight: 24 }} />

        <PrimaryButton
          label="Create account →"
          onPress={handleFinish}
          loading={loading}
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
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.borderMid,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  reviewLabel: {
    fontSize: 8,
    color: colors.textDim,
    letterSpacing: 1.5,
    fontWeight: '700',
  },
  reviewVal: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderMid,
  },
  walletNote: {
    backgroundColor: colors.cardInner,
    borderRadius: radii.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  walletNoteTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textDim,
    marginBottom: 6,
  },
  walletNoteText: {
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 15,
  },
}));
