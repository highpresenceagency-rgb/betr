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

export default function SignUpStep1() {
  const styles = useStyles();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');

  const canContinue = firstName.trim().length > 0 && username.trim().length > 0;

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
        <Text style={styles.stepLabel}>Create account · 1 of 4</Text>
        <ProgressBar step={1} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>What's your name?</Text>
          <Text style={styles.subtitle}>This is how friends will find you.</Text>
        </View>

        <View style={styles.fields}>
          <Input
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Jake"
            autoCapitalize="words"
            returnKeyType="next"
          />
          <View style={styles.gap} />
          <Input
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Rodriguez"
            autoCapitalize="words"
            returnKeyType="next"
          />
          <View style={styles.gap} />
          <Input
            label="Username"
            value={username}
            onChangeText={t => setUsername(t.replace(/[^a-z0-9_]/gi, '').toLowerCase())}
            placeholder="@jake_r"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            rightElement={null}
          />
        </View>

        <PrimaryButton
          label="Continue →"
          onPress={() => {
            signUpStore.firstName = firstName.trim();
            signUpStore.lastName = lastName.trim();
            signUpStore.username = username.trim();
            router.push('/(auth)/sign-up/step-2');
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
  fields: {
    marginBottom: 24,
  },
  gap: { height: 10 },
}));
