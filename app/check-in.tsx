import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../components/BackButton';
import { PrimaryButton } from '../components/Button';
import { colors, radii } from '../constants/theme';
import { Challenge, Participant, getChallengeById, getChallengeParticipants, getMyVotes, submitVotes } from '../lib/api';
import { supabase } from '../lib/supabase';

type VoteState = 'passing' | 'failing' | null;

export default function VoteScreen() {
  const { challengeId } = useLocalSearchParams<{ challengeId?: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [myId, setMyId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!challengeId) { setLoading(false); return; }

    Promise.all([
      getChallengeById(challengeId),
      getChallengeParticipants(challengeId),
      getMyVotes(challengeId),
      supabase.auth.getUser(),
    ]).then(([c, p, existingVotes, { data: { user } }]) => {
      setChallenge(c);
      setParticipants(p);
      setMyId(user?.id ?? null);

      // Pre-fill votes from DB and fill null for any not yet voted
      const initial: Record<string, VoteState> = {};
      for (const participant of p) {
        if (participant.user_id === user?.id) continue;
        if (participant.user_id in existingVotes) {
          initial[participant.user_id] = existingVotes[participant.user_id] ? 'passing' : 'failing';
        } else {
          initial[participant.user_id] = null;
        }
      }
      setVotes(initial);
      if (Object.keys(existingVotes).length > 0) setSubmitted(true);
      setLoading(false);
    });
  }, [challengeId]);

  const others = participants.filter(p => p.user_id !== myId);
  const allVoted = others.every(p => votes[p.user_id] !== null);

  const handleSubmit = async () => {
    if (!challengeId) return;
    setSubmitting(true);
    try {
      const voteMap: Record<string, 'passing' | 'failing'> = {};
      for (const [id, v] of Object.entries(votes)) {
        if (v !== null) voteMap[id] = v;
      }
      await submitVotes(challengeId, voteMap);
      setSubmitted(true);
      Alert.alert('Vote submitted', 'Your votes have been recorded. Results are tallied when everyone votes.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not submit votes');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <BackButton label="← Challenge" />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!challengeId || !challenge) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <BackButton label="← Challenge" />
        <Text style={styles.errorText}>No challenge selected for voting.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BackButton label="← Challenge" />
        <Text style={styles.title}>Cast your vote</Text>
        <Text style={styles.sub}>IS EVERYONE HOLDING UP THEIR END?</Text>

        <View style={styles.contextCard}>
          <Text style={styles.contextTag}>CHALLENGE</Text>
          <Text style={styles.contextName}>{challenge.goal}</Text>
          <View style={styles.shimmer} />
          <Text style={styles.contextGoal}>{challenge.duration_days} day challenge · ${challenge.bet_amount} buy-in</Text>
        </View>

        <Text style={styles.sectionTag}>VOTE ON EACH PERSON</Text>
        {others.map(person => {
          const vote = votes[person.user_id];
          return (
            <View key={person.user_id} style={styles.personCard}>
              <View style={styles.personTop}>
                <View style={styles.avDim}>
                  <Text style={styles.avText}>{person.profiles?.initials ?? '?'}</Text>
                </View>
                <Text style={styles.personName}>{person.profiles?.name ?? 'Unknown'}</Text>
              </View>
              <View style={styles.voteRow}>
                <TouchableOpacity
                  style={[styles.voteBtn, vote === 'passing' && styles.voteBtnPassActive]}
                  onPress={() => setVotes(prev => ({ ...prev, [person.user_id]: 'passing' }))}
                  activeOpacity={0.8}
                  disabled={submitted}
                >
                  <Text style={[styles.voteBtnText, vote === 'passing' && styles.voteBtnTextPass]}>✓  Keeping up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.voteBtn, vote === 'failing' && styles.voteBtnFailActive]}
                  onPress={() => setVotes(prev => ({ ...prev, [person.user_id]: 'failing' }))}
                  activeOpacity={0.8}
                  disabled={submitted}
                >
                  <Text style={[styles.voteBtnText, vote === 'failing' && styles.voteBtnTextFail]}>✗  Failed</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            If the majority votes against someone, they lose their bet. All votes are anonymous and locked at the end of the challenge.
          </Text>
        </View>

        <View style={{ height: 20 }} />
        <PrimaryButton
          label={submitted ? '✓ Votes submitted!' : submitting ? 'Submitting…' : allVoted ? 'Submit votes →' : 'Vote on everyone to continue'}
          onPress={handleSubmit}
          disabled={!allVoted || submitted || submitting}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  errorText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  sub: { fontSize: 8, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 16 },

  contextCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 16,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A',
  },
  contextTag: { fontSize: 8, color: '#2D6040', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  contextName: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  shimmer: { height: 1, backgroundColor: '#2E2E2E', marginBottom: 8 },
  contextGoal: { fontSize: 12, color: colors.textMuted },

  sectionTag: { fontSize: 8, color: '#3A3A3A', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },

  personCard: {
    backgroundColor: colors.card, borderRadius: radii.md, padding: 12, marginBottom: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#2A2A2A', borderLeftColor: '#252525', borderRightColor: '#111111', borderBottomColor: '#0A0A0A',
  },
  personTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  avDim: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#141414', alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#252525', borderLeftColor: '#1E1E1E', borderRightColor: '#0D0D0D', borderBottomColor: '#080808',
  },
  avText: { fontSize: 9, fontWeight: '700', color: '#505050' },
  personName: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },

  voteRow: { flexDirection: 'row', gap: 8 },
  voteBtn: {
    flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#111',
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#1E1E1E', borderLeftColor: '#1A1A1A', borderRightColor: '#0A0A0A', borderBottomColor: '#080808',
  },
  voteBtnPassActive: {
    backgroundColor: colors.accentDark,
    borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB,
  },
  voteBtnFailActive: {
    backgroundColor: '#1A0808',
    borderTopColor: '#3A1515', borderLeftColor: '#2A1010', borderRightColor: '#0E0505', borderBottomColor: '#090303',
  },
  voteBtnText: { fontSize: 11, fontWeight: '700', color: '#3A3A3A' },
  voteBtnTextPass: { color: colors.accent },
  voteBtnTextFail: { color: colors.red },

  infoCard: {
    backgroundColor: '#0F0F0F', borderRadius: radii.md, padding: 12, marginTop: 4,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#1E1E1E', borderLeftColor: '#1A1A1A', borderRightColor: '#0A0A0A', borderBottomColor: '#070707',
  },
  infoText: { fontSize: 10, color: '#3A3A3A', lineHeight: 16, textAlign: 'center' },
});
