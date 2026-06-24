import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { PrimaryButton } from '../../../components/Button';
import { radii, spacing } from '../../../constants/theme';
import { Profile, createChallenge, getMyFriends } from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';
import { guardGuest } from '../../../lib/guest';

const DURATIONS = [7, 14, 30, 60] as const;
const DURATION_LABELS: Record<number, string> = { 7: '7 days', 14: '14 days', 30: '30 days', 60: '60 days' };

function startDate(option: number): Date {
  const d = new Date();
  d.setHours(d.getHours() + option);
  return d;
}

const START_OPTIONS = [
  { label: 'In 1 hour', hours: 1 },
  { label: 'Tomorrow', hours: 24 },
  { label: 'In 3 days', hours: 72 },
  { label: 'In 1 week', hours: 168 },
  { label: 'In 2 weeks', hours: 336 },
  { label: 'In 1 month', hours: 720 },
] as const;

export default function CreateChallengeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [goal, setGoal] = useState('');
  const [bet, setBet] = useState('');
  const [duration, setDuration] = useState<typeof DURATIONS[number]>(30);
  const [startHours, setStartHours] = useState(168);
  const [type, setType] = useState<'private' | 'public'>('private');
  const [creatorFee, setCreatorFee] = useState(0);
  const [iParticipate, setIParticipate] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const feeSteps = [0, 1, 2, 3, 5, 8, 10];

  useFocusEffect(
    useCallback(() => {
      getMyFriends().then(setFriends);
    }, []),
  );

  const handleCreate = async () => {
    if (guardGuest('create a challenge')) return;
    if (!goal.trim()) { Alert.alert('Goal required', 'Please describe the challenge goal.'); return; }
    const betAmount = Number(bet);
    if (!bet || betAmount < 1) { Alert.alert('Bet required', 'Enter a bet amount of at least $1.'); return; }

    setSubmitting(true);
    try {
      const challengeId = await createChallenge({
        goal: goal.trim(),
        type,
        betAmount,
        durationDays: duration,
        startsAt: startDate(startHours),
        creatorFeePercent: type === 'public' ? creatorFee : 0,
        creatorParticipates: iParticipate,
      });
      router.replace(`/(home)/challenges/${challengeId}`);
    } catch (e: unknown) {
      Alert.alert('Could not create', e instanceof Error ? e.message : 'Unknown error');
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BackButton />
        <Text style={styles.title}>Host your own game</Text>
        <Text style={styles.subtitle}>Set the goal, the stake, and who’s in. You can play alongside everyone or just run it.</Text>

        <Text style={styles.label}>TYPE</Text>
        <View style={styles.typeRow}>
          <TouchableOpacity style={[styles.typeBtn, type === 'private' && styles.typeBtnActive]} onPress={() => setType('private')} activeOpacity={0.8}>
            <Text style={[styles.typeBtnText, type === 'private' && styles.typeBtnTextActive]}>🔒 Private</Text>
            <Text style={[styles.typeBtnSub, type === 'private' && styles.typeBtnSubActive]}>Invite-only</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.typeBtn, type === 'public' && styles.typeBtnActive]} onPress={() => setType('public')} activeOpacity={0.8}>
            <Text style={[styles.typeBtnText, type === 'public' && styles.typeBtnTextActive]}>🌐 Public</Text>
            <Text style={[styles.typeBtnSub, type === 'public' && styles.typeBtnSubActive]}>Open to anyone</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.label}>GOAL</Text>
        <View style={styles.inputWrap}>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Take a cold shower every day for 30 days"
            placeholderTextColor={colors.textMuted}
            value={goal}
            onChangeText={setGoal}
            multiline
            numberOfLines={2}
          />
        </View>

        <Text style={styles.label}>BET AMOUNT</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={[styles.textInput, { flex: 1, fontSize: 20, fontWeight: '800', color: colors.accent }]}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            value={bet}
            onChangeText={t => setBet(t.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
          />
        </View>

        <Text style={styles.label}>DURATION</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={styles.chipRow}>
          {DURATIONS.map(d => (
            <TouchableOpacity key={d} onPress={() => setDuration(d)} style={[styles.chip, duration === d && styles.chipActive]} activeOpacity={0.8}>
              <Text style={[styles.chipText, duration === d && styles.chipTextActive]}>{DURATION_LABELS[d]}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.label}>START DATE</Text>
        <Text style={styles.startNote}>Participants can join until the challenge starts.</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={styles.chipRow}>
          {START_OPTIONS.map(s => (
            <TouchableOpacity key={s.hours} onPress={() => setStartHours(s.hours)} style={[styles.chip, startHours === s.hours && styles.chipActive]} activeOpacity={0.8}>
              <Text style={[styles.chipText, startHours === s.hours && styles.chipTextActive]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={styles.toggleRow}>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>I'm participating</Text>
            <Text style={styles.toggleSub}>You join with a stake and compete alongside others</Text>
          </View>
          <TouchableOpacity style={[styles.toggle, iParticipate && styles.toggleActive]} onPress={() => setIParticipate(p => !p)} activeOpacity={0.8}>
            <View style={[styles.toggleThumb, iParticipate && styles.toggleThumbActive]} />
          </TouchableOpacity>
        </View>

        {type === 'public' && (
          <View style={styles.feeSection}>
            <View style={styles.feeLabelRow}>
              <Text style={styles.label}>CREATOR FEE</Text>
              <Text style={styles.feeVal}>{creatorFee}%</Text>
            </View>
            <Text style={styles.feeNote}>
              {creatorFee === 0
                ? 'No creator fee — 100% of pot goes to winners.'
                : `You earn ${creatorFee}% of the total pot as creator fee. Winners split the remaining ${100 - creatorFee}%.`}
            </Text>
            <View style={styles.feeStepsRow}>
              {feeSteps.map(step => (
                <TouchableOpacity key={step} onPress={() => setCreatorFee(step)} style={[styles.feeStep, creatorFee === step && styles.feeStepActive]} activeOpacity={0.8}>
                  <Text style={[styles.feeStepText, creatorFee === step && styles.feeStepTextActive]}>{step}%</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {type === 'private' && friends.length > 0 && (
          <>
            <Text style={styles.label}>INVITE FRIENDS</Text>
            <View style={styles.inviteRow}>
              {friends.slice(0, 8).map(f => (
                <View key={f.id} style={styles.av}>
                  <Text style={styles.avText}>{f.initials}</Text>
                </View>
              ))}
              <TouchableOpacity style={styles.avAdd} onPress={() => router.push('/(home)/friends/add')} activeOpacity={0.8}>
                <Text style={styles.avAddText}>+</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        <View style={styles.verifyCard}>
          <Text style={styles.verifyTitle}>🎥  Verification: video + AI + group</Text>
          <Text style={styles.verifyText}>
            Participants post in-app video proof. AI screens every clip, your accountability group can flag issues, and anything suspicious goes to a neutral reviewer.
          </Text>
        </View>

        <View style={{ height: 24 }} />
        <PrimaryButton
          label={submitting ? 'Creating…' : (type === 'private' ? 'Create & Send Invites →' : 'Create Challenge →')}
          onPress={handleCreate}
          disabled={submitting}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textDim, lineHeight: 18, marginTop: 4, marginBottom: 20 },

  label: { fontSize: 10, color: colors.textDim, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '800', marginBottom: 7 },

  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1, backgroundColor: colors.card, borderRadius: radii.md, padding: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.borderMid,
  },
  typeBtnActive: { backgroundColor: colors.accentDark, borderColor: colors.accentBorder },
  typeBtnText: { fontSize: 14, fontWeight: '800', color: colors.textDim, marginBottom: 2 },
  typeBtnTextActive: { color: colors.accent },
  typeBtnSub: { fontSize: 10, color: colors.textMuted },
  typeBtnSubActive: { color: colors.textSecondary },

  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.input, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  dollarSign: { fontSize: 20, fontWeight: '800', color: colors.accent, marginRight: 4 },
  textInput: { fontSize: 14, color: colors.textPrimary, flex: 1 },

  startNote: { fontSize: 11, color: colors.textMuted, marginBottom: 8, marginTop: -2 },

  chipRow: { flexDirection: 'row', gap: 6, paddingRight: 16 },
  chip: {
    backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8,
    borderWidth: 1.5, borderColor: colors.borderMid,
  },
  chipActive: { backgroundColor: colors.accentDark, borderColor: colors.accentBorder },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textDim },
  chipTextActive: { color: colors.accent },

  toggleRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.card, borderRadius: radii.md, padding: 14, marginBottom: 16,
    borderWidth: 1.5, borderColor: colors.borderMid,
  },
  toggleInfo: { flex: 1 },
  toggleLabel: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  toggleSub: { fontSize: 11, color: colors.textDim, lineHeight: 15 },
  toggle: {
    width: 46, height: 28, borderRadius: 14, backgroundColor: colors.input, justifyContent: 'center', paddingHorizontal: 3,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  toggleActive: { backgroundColor: colors.accentDark, borderColor: colors.accentBorder },
  toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.textMuted },
  toggleThumbActive: { backgroundColor: colors.accent, alignSelf: 'flex-end' },

  feeSection: { marginBottom: 16 },
  feeLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  feeVal: { fontSize: 14, fontWeight: '900', color: colors.accent },
  feeNote: { fontSize: 11, color: colors.textDim, lineHeight: 15, marginBottom: 10 },
  feeStepsRow: { flexDirection: 'row', gap: 6 },
  feeStep: {
    flex: 1, backgroundColor: colors.card, borderRadius: 8, paddingVertical: 10, alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.borderMid,
  },
  feeStepActive: { backgroundColor: colors.accentDark, borderColor: colors.accentBorder },
  feeStepText: { fontSize: 11, fontWeight: '800', color: colors.textDim },
  feeStepTextActive: { color: colors.accent },

  inviteRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  av: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentDark, borderWidth: 1.5, borderColor: colors.accentBorder,
  },
  avText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  avAdd: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.borderMid,
  },
  avAddText: { fontSize: 22, color: colors.textDim, lineHeight: 24 },

  verifyCard: {
    backgroundColor: colors.cardInner, borderRadius: radii.md, padding: 14, marginTop: 4,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  verifyTitle: { fontSize: 13, fontWeight: '800', color: colors.textSecondary, marginBottom: 4 },
  verifyText: { fontSize: 12, color: colors.textDim, lineHeight: 17 },
}));
