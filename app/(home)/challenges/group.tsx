import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import ProofPlayer from '../../../components/ProofPlayer';
import { radii, spacing } from '../../../constants/theme';
import {
  FLAG_LABELS, FlagReason, flagSubmission, getGroupFeed, getMyGroup, Profile, Submission,
} from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';

const FLAGGABLE: Submission['status'][] = ['pending_ml', 'auto_approved', 'in_review'];

export default function GroupView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();

  const [members, setMembers] = useState<Profile[]>([]);
  const [feed, setFeed] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [{ members }, f] = await Promise.all([getMyGroup(id), getGroupFeed(id)]);
    setMembers(members);
    setFeed(f);
    setLoading(false);
  }
  useEffect(() => { load(); }, [id]);

  async function flag(sub: Submission, reason: FlagReason) {
    setBusy(sub.id);
    try {
      await flagSubmission(sub.id, reason);
      setFlagged((s) => new Set(s).add(sub.id));
    } catch (e) {
      Alert.alert('Could not flag', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  }

  function statusColor(s: Submission['status']) {
    if (s === 'approved' || s === 'auto_approved') return colors.accent;
    if (s === 'in_review') return colors.amber;
    if (s === 'rejected') return colors.red;
    return colors.textDim;
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <Text style={styles.title}>Your group</Text>
        <Text style={styles.subtitle}>
          {members.length} members keeping each other honest. Flagging is one-tap and anonymous to the submitter.
        </Text>

        {/* member chips */}
        <View style={styles.memberRow}>
          {members.map((m) => (
            <View key={m.id} style={styles.avatar}>
              <Text style={styles.avatarText}>{m.initials || m.username.slice(0, 2).toUpperCase()}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Recent proof</Text>
        {feed.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={36} color={colors.textDim} />
            <Text style={styles.dim}>No submissions from your group yet today.</Text>
          </View>
        ) : (
          feed.map((sub) => {
            const isFlagged = flagged.has(sub.id);
            const canFlag = FLAGGABLE.includes(sub.status) && !isFlagged;
            return (
              <View key={sub.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={styles.avatarSm}>
                    <Text style={styles.avatarText}>
                      {sub.profiles?.initials || sub.profiles?.username?.slice(0, 2).toUpperCase() || '??'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>{sub.profiles?.name || sub.profiles?.username || 'Member'}</Text>
                    <Text style={styles.meta}>{sub.proof_date}</Text>
                  </View>
                  <View style={[styles.badge, { borderColor: statusColor(sub.status) }]}>
                    <Text style={[styles.badgeText, { color: statusColor(sub.status) }]}>
                      {sub.status.replace('_', ' ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.statsRow}>
                  {sub.ml_rep_count != null && (
                    <Text style={styles.stat}>
                      <Text style={styles.statValue}>{sub.ml_rep_count}</Text>
                      {sub.ml_target ? ` / ${sub.ml_target}` : ''} reps
                    </Text>
                  )}
                  {sub.ml_suspicion != null && (
                    <Text style={styles.stat}>suspicion <Text style={styles.statValue}>{Math.round(sub.ml_suspicion * 100)}%</Text></Text>
                  )}
                  <ProofPlayer submissionId={sub.id} />
                </View>

                {isFlagged ? (
                  <View style={styles.flaggedNote}>
                    <Ionicons name="flag" size={14} color={colors.amber} />
                    <Text style={styles.flaggedText}>Flagged — sent to a neutral reviewer. Thanks.</Text>
                  </View>
                ) : canFlag ? (
                  <View style={styles.flagWrap}>
                    <Text style={styles.flagPrompt}>See a problem? Tap one:</Text>
                    <View style={styles.flagChips}>
                      {(Object.keys(FLAG_LABELS) as FlagReason[]).map((r) => (
                        <TouchableOpacity
                          key={r}
                          style={styles.chip}
                          activeOpacity={0.8}
                          disabled={busy === sub.id}
                          onPress={() => flag(sub, r)}
                        >
                          <Text style={styles.chipText}>{FLAG_LABELS[r]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.bgPage },
  center: { flex: 1, backgroundColor: colors.bgPage, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '900' },
  subtitle: { color: colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: spacing.lg },
  memberRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  avatar: {
    width: 38, height: 38, borderRadius: radii.full, backgroundColor: colors.accentDark,
    borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center',
  },
  avatarSm: {
    width: 34, height: 34, borderRadius: radii.full, backgroundColor: colors.accentDark,
    borderWidth: 1, borderColor: colors.accentBorder, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  sectionLabel: {
    color: colors.textDim, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.md,
  },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  dim: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderMid,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 12, marginTop: 1 },
  badge: { borderWidth: 1, borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md },
  stat: { color: colors.textSecondary, fontSize: 13 },
  statValue: { color: colors.textPrimary, fontWeight: '800' },
  flagWrap: { marginTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderDark, paddingTop: spacing.md },
  flagPrompt: { color: colors.textDim, fontSize: 12, marginBottom: spacing.sm },
  flagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: 7, paddingHorizontal: spacing.md,
    backgroundColor: colors.input, borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  flaggedNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.md },
  flaggedText: { color: colors.amber, fontSize: 12, fontWeight: '600' },
}));
