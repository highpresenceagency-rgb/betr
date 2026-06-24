import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { radii, spacing } from '../constants/theme';
import { Challenge } from '../lib/api';
import { makeStyles, useTheme } from '../lib/theme';

function goalEmoji(goal: string): string {
  const g = (goal || '').toLowerCase();
  if (/push|press/.test(g)) return '💪';
  if (/run|5k|jog|mile|sprint/.test(g)) return '🏃';
  if (/squat|leg|lunge/.test(g)) return '🦵';
  if (/plank|core|abs|sit-?up|crunch/.test(g)) return '🧘';
  if (/walk|step/.test(g)) return '👟';
  if (/bike|cycl|spin/.test(g)) return '🚴';
  if (/water|hydrat|drink/.test(g)) return '💧';
  if (/yoga|stretch/.test(g)) return '🧘';
  return '🏆';
}
const fmt = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
const money = (n: number) => '$' + Math.round(n).toLocaleString();

export default function GameCard({ challenge, onPress }: { challenge: Challenge; onPress?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const weeks = Math.max(1, Math.round(challenge.duration_days / 7));
  const coach = challenge.profiles?.name || challenge.profiles?.username || 'Community';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={onPress}>
      <View style={styles.thumb}>
        <Text style={styles.thumbEmoji}>{goalEmoji(challenge.goal)}</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.coach} numberOfLines={1}>{coach}</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textDim} />
        </View>
        <Text style={styles.meta}>
          {weeks} week game · {fmt(challenge.starts_at)}{challenge.ends_at ? ` – ${fmt(challenge.ends_at)}` : ''}
        </Text>
        <Text style={styles.title} numberOfLines={2}>{challenge.goal}</Text>

        <View style={styles.stats}>
          <Stat value={money(challenge.bet_amount)} label="bet" styles={styles} />
          <Stat value={String(challenge.participant_count)} label="players" styles={styles} />
          <Stat value={money(challenge.pot)} label="pot" styles={styles} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function Stat({ value, label, styles }: { value: string; label: string; styles: any }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderMid,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  thumb: {
    width: 84, height: 84, borderRadius: radii.md,
    backgroundColor: colors.accentDark,
    borderWidth: 1, borderColor: colors.accentBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbEmoji: { fontSize: 38 },
  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coach: { flex: 1, color: colors.accent, fontSize: 13, fontWeight: '800', fontStyle: 'italic' },
  meta: { color: colors.textDim, fontSize: 11, marginTop: 1, marginBottom: 4 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', lineHeight: 21, marginBottom: 10 },
  stats: { flexDirection: 'row', gap: spacing.lg },
  stat: {},
  statValue: { color: colors.textPrimary, fontSize: 15, fontWeight: '900' },
  statLabel: { color: colors.textDim, fontSize: 11, marginTop: -1 },
}));
