import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import ProofPlayer from '../../../components/ProofPlayer';
import { radii, spacing } from '../../../constants/theme';
import { getMyReviewQueue, ReviewItem, submitReview } from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';

// pretty labels for the ML signal keys the worker emits
const SIGNAL_LABELS: Record<string, string> = {
  token_missing: 'Code not detected',
  rep_shortfall: 'Reps under target',
  sped_up: 'Looks sped up',
  looped: 'Repeated frames',
  person_inconsistent: 'Person changes',
};

export default function ReviewQueue() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [queue, setQueue] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    setQueue(await getMyReviewQueue());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function decide(item: ReviewItem, decision: 'approved' | 'rejected') {
    setBusy(item.id);
    try {
      await submitReview(item.submission_id, decision);
      setQueue((q) => q.filter((x) => x.id !== item.id));
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={colors.accent} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <Text style={styles.title}>Review queue</Text>
        <Text style={styles.subtitle}>
          You’re a neutral reviewer — none of these are from your own games, so your call is unbiased and binding.
        </Text>

        {queue.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="checkmark-done-circle-outline" size={40} color={colors.textDim} />
            <Text style={styles.dim}>Nothing to review right now.</Text>
          </View>
        ) : (
          queue.map((item) => {
            const sub = item.submissions;
            const signals = (sub.ml_signals ?? {}) as Record<string, number>;
            const reasons = Object.keys(SIGNAL_LABELS).filter((k) => Number(signals[k]) >= 0.3);
            return (
              <View key={item.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.kind}>{item.kind === 'paid' ? 'PAID REVIEW' : 'NEUTRAL REVIEW'}</Text>
                  <ProofPlayer submissionId={sub.id} />
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
                  <Text style={styles.stat}>token {sub.token_detected === true ? '✓' : sub.token_detected === false ? '✗' : '—'}</Text>
                </View>

                {reasons.length > 0 && (
                  <View style={styles.reasons}>
                    {reasons.map((r) => (
                      <View key={r} style={styles.reasonChip}>
                        <Text style={styles.reasonText}>{SIGNAL_LABELS[r]}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.q}>Did they complete the rep target with valid form?</Text>
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.action, styles.reject]}
                    activeOpacity={0.85}
                    disabled={busy === item.id}
                    onPress={() => decide(item, 'rejected')}
                  >
                    <Ionicons name="close" size={18} color={colors.red} />
                    <Text style={[styles.actionText, { color: colors.red }]}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.action, styles.approve]}
                    activeOpacity={0.85}
                    disabled={busy === item.id}
                    onPress={() => decide(item, 'approved')}
                  >
                    <Ionicons name="checkmark" size={18} color={colors.accent} />
                    <Text style={[styles.actionText, { color: colors.accent }]}>Approve</Text>
                  </TouchableOpacity>
                </View>
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
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  dim: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  card: {
    backgroundColor: colors.card, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.borderMid,
    padding: spacing.lg, marginBottom: spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kind: { color: colors.textDim, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginTop: spacing.md, flexWrap: 'wrap' },
  stat: { color: colors.textSecondary, fontSize: 13 },
  statValue: { color: colors.textPrimary, fontWeight: '800' },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  reasonChip: {
    paddingVertical: 5, paddingHorizontal: 10, borderRadius: radii.full,
    backgroundColor: colors.input, borderWidth: 1, borderColor: colors.amber,
  },
  reasonText: { color: colors.amber, fontSize: 11, fontWeight: '600' },
  q: { color: colors.textSecondary, fontSize: 14, fontWeight: '600', marginTop: spacing.lg, marginBottom: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, borderRadius: radii.lg, borderWidth: 1.5,
  },
  reject: { backgroundColor: colors.input, borderColor: colors.red },
  approve: { backgroundColor: colors.accentDark, borderColor: colors.accentBorder },
  actionText: { fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
}));
