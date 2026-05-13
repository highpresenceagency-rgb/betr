import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { PrimaryButton } from '../../../components/Button';
import { colors, radii } from '../../../constants/theme';
import {
  Challenge, Participant,
  daysLeft, effectiveStatus,
  getChallengeById, getChallengeParticipants, joinChallenge, processPayout,
} from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [joined, setJoined] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);

  const handleProcessPayout = () => {
    Alert.alert(
      'Process payouts?',
      'This will tally all votes, pay out winners, and close the challenge. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Process',
          onPress: async () => {
            setProcessingPayout(true);
            try {
              await processPayout(id!);
              const [updated, p] = await Promise.all([getChallengeById(id!), getChallengeParticipants(id!)]);
              setChallenge(updated);
              setParticipants(p);
              Alert.alert('Payouts processed', 'Winners have been paid out and the challenge is now closed.');
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Payout failed');
            } finally {
              setProcessingPayout(false);
            }
          },
        },
      ],
    );
  };

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      setLoading(true);

      Promise.all([
        getChallengeById(id),
        getChallengeParticipants(id),
        supabase.auth.getUser(),
      ]).then(([c, p, { data: { user } }]) => {
        if (!active) return;
        const userId = user?.id ?? null;
        setChallenge(c);
        setParticipants(p);
        setJoined(p.some(pt => pt.user_id === userId));
        setMyId(userId);
        setLoading(false);
      });

      return () => { active = false; };
    }, [id]),
  );

  const handleJoin = () => {
    if (!challenge) return;
    Alert.alert(
      `Join for $${challenge.bet_amount}?`,
      'This amount will be locked in your wallet until the challenge ends.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Confirm — $${challenge.bet_amount}`,
          onPress: async () => {
            setJoining(true);
            try {
              await joinChallenge(id!);
              setJoined(true);
              const p = await getChallengeParticipants(id!);
              setParticipants(p);
            } catch (e: unknown) {
              Alert.alert('Could not join', e instanceof Error ? e.message : 'Unknown error');
            } finally {
              setJoining(false);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <BackButton label="← Challenges" />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!challenge) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="light" />
        <BackButton label="← Challenges" />
        <Text style={styles.errorText}>Challenge not found.</Text>
      </SafeAreaView>
    );
  }

  const status = effectiveStatus(challenge);
  const left = daysLeft(challenge.ends_at);
  const isVoting = status === 'voting';
  const isCreator = myId === challenge.creator_id;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BackButton label="← Challenges" />

        <View style={styles.titleRow}>
          <View style={styles.titleLeft}>
            <Text style={styles.title}>{challenge.goal}</Text>
            {challenge.ends_at && (
              <Text style={styles.dates}>
                Ends {new Date(challenge.ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {left}d left
              </Text>
            )}
          </View>
          <View style={[styles.livePill, (status === 'pending' || status === 'completed' || status === 'cancelled') && styles.livePillDim]}>
            <View style={[styles.liveDot, { backgroundColor: status === 'voting' ? colors.amber : status === 'live' ? colors.accent : '#555' }]} />
            <Text style={[styles.liveText, (status === 'pending' || status === 'completed' || status === 'cancelled') && styles.liveTextDim]}>
              {status === 'voting' ? 'Voting' : status === 'completed' ? 'Ended' : status === 'pending' ? 'Soon' : status === 'cancelled' ? 'Cancelled' : 'Live'}
            </Text>
          </View>
        </View>

        <View style={styles.typePillRow}>
          <View style={[styles.typePill, challenge.type === 'private' ? styles.typePillPrivate : styles.typePillPublic]}>
            <Text style={[styles.typePillText, challenge.type === 'private' ? styles.typePillTextPrivate : styles.typePillTextPublic]}>
              {challenge.type === 'private' ? '🔒 Private challenge' : '🌐 Public challenge'}
            </Text>
          </View>
        </View>

        <View style={styles.potCard}>
          <View style={styles.potRow}>
            <View>
              <Text style={styles.potTag}>TOTAL POT</Text>
              <Text style={styles.potAmt}>${challenge.pot.toFixed(0)}</Text>
            </View>
            <View style={styles.betRight}>
              <Text style={styles.potTag}>BET TO JOIN</Text>
              <Text style={styles.betAmt}>${challenge.bet_amount}</Text>
            </View>
          </View>
          <View style={styles.shimmer} />
          <View style={styles.potFooter}>
            <Text style={styles.potFooterLeft}>{challenge.participant_count} participants × ${challenge.bet_amount}</Text>
            <Text style={styles.potPayout}>{challenge.creator_fee_percent > 0 ? `${100 - challenge.creator_fee_percent}% to winners` : '100% to winners'}</Text>
          </View>
        </View>

        {challenge.creator_fee_percent > 0 && (
          <View style={styles.payoutCard}>
            <Text style={styles.sectionTag}>PAYOUT STRUCTURE</Text>
            <View style={styles.payoutRow}>
              <Text style={styles.payoutLabel}>Winners share</Text>
              <Text style={styles.payoutVal}>{100 - challenge.creator_fee_percent}%</Text>
            </View>
            <View style={styles.payoutRow}>
              <Text style={styles.payoutLabel}>Creator fee</Text>
              <Text style={[styles.payoutVal, { color: colors.textMuted }]}>{challenge.creator_fee_percent}%</Text>
            </View>
          </View>
        )}

        <View style={styles.goalCard}>
          <Text style={styles.sectionTag}>GOAL</Text>
          <Text style={styles.goalText}>{challenge.goal}</Text>
          <View style={styles.shimmer} />
          <View style={styles.verifyPill}>
            <Text style={styles.verifyText}>🗳  Verification: group vote</Text>
          </View>
        </View>

        {participants.length > 0 && (
          <View style={styles.standingsCard}>
            <Text style={styles.sectionTag}>PARTICIPANTS</Text>
            <View style={styles.standingsList}>
              {participants.map((p, i) => {
                const isMe = p.user_id === myId;
                return (
                  <View key={p.user_id} style={styles.standingRow}>
                    <View style={styles.standingLeft}>
                      <Text style={[styles.rank, i === 0 ? styles.rankFirst : styles.rankRest]}>{i + 1}</Text>
                      <View style={[styles.av, isMe ? styles.avGreen : styles.avDim]}>
                        <Text style={[styles.avText, isMe ? styles.avTextGreen : styles.avTextDim]}>
                          {p.profiles?.initials ?? '?'}
                        </Text>
                      </View>
                      <Text style={[styles.standingName, !isMe && styles.standingNameDim]}>
                        {p.profiles?.name ?? 'Unknown'}
                      </Text>
                    </View>
                    <View style={styles.standingRight}>
                      <Text style={[styles.standingStatus, { color: p.status === 'eliminated' ? colors.red : p.status === 'won' ? colors.accent : colors.textMuted }]}>
                        {p.status === 'active' ? 'Active' : p.status === 'won' ? 'Won' : 'Eliminated'}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View style={{ height: 12 }} />

        {joined || isCreator ? (
          <>
            {isVoting && joined && (
              <>
                <PrimaryButton label="Cast your votes →" onPress={() => router.push({ pathname: '/check-in', params: { challengeId: id } })} />
                <View style={{ height: 8 }} />
              </>
            )}
            {isVoting && isCreator && (
              <>
                <TouchableOpacity style={styles.payoutBtn} onPress={handleProcessPayout} disabled={processingPayout}>
                  <Text style={styles.payoutBtnText}>{processingPayout ? 'Processing…' : 'Process payouts & close →'}</Text>
                </TouchableOpacity>
                <View style={{ height: 8 }} />
              </>
            )}
            {status !== 'completed' && status !== 'cancelled' && (
              <TouchableOpacity style={styles.inviteBtn} onPress={() => router.push({ pathname: '/(home)/challenges/invite', params: { goal: challenge.goal, challengeId: id } })}>
                <Text style={styles.inviteBtnText}>Invite friends →</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (status === 'pending' || status === 'live') ? (
          <PrimaryButton
            label={joining ? 'Joining…' : `Join for $${challenge.bet_amount} →`}
            onPress={handleJoin}
            disabled={joining}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 },
  errorText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  titleLeft: { flex: 1, marginRight: 10 },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 2 },
  dates: { fontSize: 10, color: colors.textMuted },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.accentDark, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
  liveText: { fontSize: 9, fontWeight: '700', color: colors.accent },
  livePillDim: { backgroundColor: '#111', borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808' },
  liveTextDim: { color: '#555' },

  typePillRow: { marginBottom: 10 },
  typePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  typePillPrivate: { backgroundColor: '#141414', borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: '#2A2A2A', borderLeftColor: '#242424', borderRightColor: '#111', borderBottomColor: '#0A0A0A' },
  typePillPublic: { backgroundColor: '#0F1A14', borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderTopColor: '#1E3025', borderLeftColor: '#182A1E', borderRightColor: '#0A1410', borderBottomColor: '#070F0B' },
  typePillText: { fontSize: 10, fontWeight: '600' },
  typePillTextPrivate: { color: '#555' },
  typePillTextPublic: { color: '#3A6A4A' },

  potCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A',
  },
  potRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  potTag: { fontSize: 8, color: '#3A3A3A', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' },
  potAmt: { fontSize: 36, fontWeight: '900', color: colors.accent, letterSpacing: -1.5 },
  betRight: { alignItems: 'flex-end' },
  betAmt: { fontSize: 22, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
  shimmer: { height: 1, backgroundColor: '#2E2E2E', marginVertical: 8 },
  potFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  potFooterLeft: { fontSize: 10, color: colors.textMuted },
  potPayout: { fontSize: 9, color: '#2E2E2E' },

  payoutCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A',
  },
  payoutRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  payoutLabel: { fontSize: 12, color: colors.textSecondary },
  payoutVal: { fontSize: 12, fontWeight: '700', color: colors.accent },

  sectionTag: { fontSize: 8, color: '#3A3A3A', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },

  goalCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A',
  },
  goalText: { fontSize: 13, color: colors.textSecondary, marginBottom: 8, lineHeight: 19 },
  verifyPill: {
    alignSelf: 'flex-start', backgroundColor: colors.accentDark, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB,
  },
  verifyText: { fontSize: 10, color: colors.accent, fontWeight: '600' },

  standingsCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A',
  },
  standingsList: { gap: 5 },
  standingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808',
  },
  standingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { fontSize: 11, fontWeight: '700', width: 14 },
  rankFirst: { color: colors.accent },
  rankRest: { color: '#444' },
  av: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avGreen: {
    backgroundColor: colors.accentDark,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#3A7A45', borderLeftColor: '#2A6035', borderRightColor: '#0E1F12', borderBottomColor: '#091508',
  },
  avDim: {
    backgroundColor: '#141414',
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#252525', borderLeftColor: '#1E1E1E', borderRightColor: '#0D0D0D', borderBottomColor: '#080808',
  },
  avText: { fontSize: 8, fontWeight: '700' },
  avTextGreen: { color: colors.accent },
  avTextDim: { color: '#3A3A3A' },
  standingName: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  standingNameDim: { color: '#555' },
  standingRight: { alignItems: 'flex-end' },
  standingStatus: { fontSize: 9 },

  inviteBtn: { alignItems: 'center', paddingVertical: 8 },
  inviteBtnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  payoutBtn: { alignItems: 'center', paddingVertical: 8 },
  payoutBtnText: { color: colors.amber, fontSize: 12, fontWeight: '600' },
});
