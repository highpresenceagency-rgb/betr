import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { PrimaryButton } from '../../../components/Button';
import { radii } from '../../../constants/theme';
import {
  Challenge, Participant,
  daysLeft, effectiveStatus,
  getChallengeById, getChallengeParticipants, getChallengeProgress, joinChallenge, processPayout,
} from '../../../lib/api';
import { guardGuest } from '../../../lib/guest';
import { supabase } from '../../../lib/supabase';
import { makeStyles, useTheme } from '../../../lib/theme';

type Progress = { approved: number; required: number; allowedMisses: number };

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [joined, setJoined] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [processingPayout, setProcessingPayout] = useState(false);

  const handleProcessPayout = () => {
    if (guardGuest('process payouts')) return;
    Alert.alert(
      'Settle this challenge?',
      'This pays out everyone who completed the challenge and closes it. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle',
          onPress: async () => {
            setProcessingPayout(true);
            try {
              await processPayout(id!);
              const [updated, p] = await Promise.all([getChallengeById(id!), getChallengeParticipants(id!)]);
              setChallenge(updated);
              setParticipants(p);
              Alert.alert('Done', 'Winners have been paid and the challenge is closed.');
            } catch (e: unknown) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Settlement failed');
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
        getChallengeProgress(id),
        supabase.auth.getUser(),
      ]).then(([c, p, prog, { data: { user } }]) => {
        if (!active) return;
        const userId = user?.id ?? null;
        setChallenge(c);
        setParticipants(p);
        setProgress(prog);
        setJoined(p.some(pt => pt.user_id === userId));
        setMyId(userId);
        setLoading(false);
      });

      return () => { active = false; };
    }, [id]),
  );

  const handleJoin = () => {
    if (!challenge) return;
    if (guardGuest('join this challenge')) return;
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
        <StatusBar style="auto" />
        <BackButton label="← Challenges" />
        <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!challenge) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar style="auto" />
        <BackButton label="← Challenges" />
        <Text style={styles.errorText}>Challenge not found.</Text>
      </SafeAreaView>
    );
  }

  const status = effectiveStatus(challenge);
  const left = daysLeft(challenge.ends_at);
  const isVoting = status === 'voting';
  const isCreator = myId === challenge.creator_id;
  const need = progress ? Math.max(1, progress.required - progress.allowedMisses) : 0;
  const pct = need > 0 && progress ? Math.min(1, progress.approved / need) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
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
            <View style={[styles.liveDot, { backgroundColor: status === 'voting' ? colors.amber : status === 'live' ? colors.accent : colors.textDim }]} />
            <Text style={[styles.liveText, (status === 'pending' || status === 'completed' || status === 'cancelled') && styles.liveTextDim]}>
              {status === 'voting' ? 'Reviewing' : status === 'completed' ? 'Ended' : status === 'pending' ? 'Soon' : status === 'cancelled' ? 'Cancelled' : 'Live'}
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
              <Text style={styles.potAmt}>${Math.round(challenge.pot).toLocaleString()}</Text>
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

        {/* progress toward completion (you win by finishing, not by beating others) */}
        {joined && progress && need > 0 && (
          <View style={styles.progressCard}>
            <Text style={styles.sectionTag}>YOUR PROGRESS</Text>
            <Text style={styles.progressNums}>
              <Text style={styles.progressBig}>{progress.approved}</Text> / {need} approved
              {progress.allowedMisses > 0 ? `  ·  ${progress.allowedMisses} misses allowed` : ''}
            </Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${pct * 100}%` }]} /></View>
          </View>
        )}

        <View style={styles.goalCard}>
          <Text style={styles.sectionTag}>GOAL</Text>
          <Text style={styles.goalText}>{challenge.goal}</Text>
          {challenge.target_reps ? <Text style={styles.goalText}>Target: {challenge.target_reps} reps per submission</Text> : null}
          <View style={styles.shimmer} />
          <View style={styles.verifyPill}>
            <Text style={styles.verifyText}>🎥  Verified by video + AI + your group</Text>
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
            {joined && status === 'live' && (
              <>
                <PrimaryButton
                  label="Record today’s proof →"
                  onPress={() => router.push({ pathname: '/proof', params: { id } })}
                />
                <View style={{ height: 8 }} />
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={() => router.push({ pathname: '/(home)/challenges/group', params: { id } })}
                >
                  <Text style={styles.secondaryBtnText}>Your accountability group →</Text>
                </TouchableOpacity>
                <View style={{ height: 8 }} />
              </>
            )}
            {isVoting && (
              <View style={styles.noteCard}>
                <Text style={styles.noteText}>Challenge ended — final proof reviews are wrapping up before payout.</Text>
              </View>
            )}
            {isVoting && isCreator && (
              <>
                <TouchableOpacity style={styles.payoutBtn} onPress={handleProcessPayout} disabled={processingPayout}>
                  <Text style={styles.payoutBtnText}>{processingPayout ? 'Settling…' : 'Settle & close →'}</Text>
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

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 },
  errorText: { color: colors.textMuted, textAlign: 'center', marginTop: 40, fontSize: 14 },

  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  titleLeft: { flex: 1, marginRight: 10 },
  title: { fontSize: 20, fontWeight: '900', color: colors.textPrimary, marginBottom: 2, letterSpacing: -0.3 },
  dates: { fontSize: 11, color: colors.textMuted },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.accentDark, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
  liveText: { fontSize: 9, fontWeight: '700', color: colors.accent },
  livePillDim: { backgroundColor: colors.input, borderColor: colors.borderMid },
  liveTextDim: { color: colors.textDim },

  typePillRow: { marginBottom: 10 },
  typePill: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  typePillPrivate: { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.borderMid },
  typePillPublic: { backgroundColor: colors.accentDark, borderWidth: 1, borderColor: colors.accentBorder },
  typePillText: { fontSize: 10, fontWeight: '600' },
  typePillTextPrivate: { color: colors.textDim },
  typePillTextPublic: { color: colors.accent },

  potCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  potRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  potTag: { fontSize: 9, color: colors.textDim, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700' },
  potAmt: { fontSize: 36, fontWeight: '900', color: colors.accent, letterSpacing: -1.5 },
  betRight: { alignItems: 'flex-end' },
  betAmt: { fontSize: 22, fontWeight: '700', color: colors.textSecondary, marginTop: 4 },
  shimmer: { height: 1, backgroundColor: colors.borderMid, marginVertical: 8 },
  potFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  potFooterLeft: { fontSize: 11, color: colors.textMuted },
  potPayout: { fontSize: 10, color: colors.textMuted },

  progressCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  progressNums: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  progressBig: { color: colors.accent, fontSize: 18, fontWeight: '900' },
  progressTrack: { height: 6, borderRadius: 3, backgroundColor: colors.input, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.accent },

  sectionTag: { fontSize: 10, color: colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },

  goalCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 16, marginBottom: 8,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  goalText: { fontSize: 14, color: colors.textSecondary, marginBottom: 8, lineHeight: 20 },
  verifyPill: {
    alignSelf: 'flex-start', backgroundColor: colors.accentDark, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  verifyText: { fontSize: 11, color: colors.accent, fontWeight: '600' },

  standingsCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  standingsList: { gap: 6 },
  standingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.input, borderRadius: radii.md, paddingHorizontal: 10, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  standingLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rank: { fontSize: 11, fontWeight: '700', width: 14 },
  rankFirst: { color: colors.accent },
  rankRest: { color: colors.textDim },
  av: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  avGreen: {
    backgroundColor: colors.accentDark,
    borderWidth: 1.5, borderColor: colors.accentBorder,
  },
  avDim: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  avText: { fontSize: 9, fontWeight: '700' },
  avTextGreen: { color: colors.accent },
  avTextDim: { color: colors.textDim },
  standingName: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  standingNameDim: { color: colors.textDim },
  standingRight: { alignItems: 'flex-end' },
  standingStatus: { fontSize: 9 },

  secondaryBtn: {
    width: '100%', alignItems: 'center', paddingVertical: 14, borderRadius: radii.lg,
    backgroundColor: colors.input, borderWidth: 1.5, borderColor: colors.borderLight,
  },
  secondaryBtnText: { color: colors.accent, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  noteCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  noteText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  inviteBtn: { alignItems: 'center', paddingVertical: 8 },
  inviteBtnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  payoutBtn: { alignItems: 'center', paddingVertical: 8 },
  payoutBtnText: { color: colors.amber, fontSize: 12, fontWeight: '600' },
}));
