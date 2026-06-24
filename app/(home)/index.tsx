import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameCard from '../../components/GameCard';
import Logo from '../../components/Logo';
import { radii, spacing } from '../../constants/theme';
import { Challenge, Profile, getMyActiveChallenges, getMyProfile, getPublicFeed } from '../../lib/api';
import { makeStyles, useTheme } from '../../lib/theme';

function goalEmoji(goal: string): string {
  const g = (goal || '').toLowerCase();
  if (/push|press/.test(g)) return '💪';
  if (/run|5k|jog|mile|sprint/.test(g)) return '🏃';
  if (/squat|leg|lunge/.test(g)) return '🦵';
  if (/plank|core|abs|sit-?up|crunch/.test(g)) return '🧘';
  if (/walk|step/.test(g)) return '👟';
  if (/bike|cycl|spin/.test(g)) return '🚴';
  if (/water|hydrat|drink/.test(g)) return '💧';
  return '🏆';
}
const money = (n: number) => '$' + Math.round(n).toLocaleString();

export default function HomeScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [featured, setFeatured] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getMyProfile(), getMyActiveChallenges(), getPublicFeed()]).then(([p, c, f]) => {
        if (!active) return;
        setProfile(p);
        setChallenges(c);
        setFeatured(f);
        setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const initials = profile?.initials ?? '??';
  const firstName = profile?.name?.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const open = (id: string) => router.push(`/(home)/challenges/${id}`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{firstName ? `${greeting}, ${firstName}` : greeting}</Text>
            <Logo size="md" />
          </View>
          <TouchableOpacity onPress={() => router.push('/(home)/profile/')} style={styles.avatar} activeOpacity={0.8}>
            <Text style={styles.avatarText}>{initials}</Text>
          </TouchableOpacity>
        </View>

        {/* Featured strip — trending public games */}
        {featured.length > 0 && (
          <>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTag}>FEATURED</Text>
              <TouchableOpacity onPress={() => router.push('/(home)/challenges/')}>
                <Text style={styles.seeAll}>See all →</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.strip}
              style={styles.stripWrap}
            >
              {featured.slice(0, 6).map((c) => (
                <TouchableOpacity key={c.id} style={styles.tile} activeOpacity={0.85} onPress={() => open(c.id)}>
                  <View style={styles.tileThumb}>
                    <Text style={styles.tileEmoji}>{goalEmoji(c.goal)}</Text>
                  </View>
                  <Text style={styles.tileGoal} numberOfLines={2}>{c.goal}</Text>
                  <View style={styles.tileStats}>
                    <Text style={styles.tilePot}>{money(c.pot)}</Text>
                    <Text style={styles.tilePlayers}>{c.participant_count} in</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTag}>YOUR ACTIVE GAMES</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
        ) : challenges.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>You haven’t joined a game yet.</Text>
            <TouchableOpacity onPress={() => router.push('/(home)/challenges/')}>
              <Text style={styles.emptyLink}>Browse challenges →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          challenges.map((c) => <GameCard key={c.id} challenge={c} onPress={() => open(c.id)} />)
        )}

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(home)/challenges/')} activeOpacity={0.8}>
            <Text style={styles.quickLabel}>Browse feed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.quickBtn, styles.quickBtnPrimary]} onPress={() => router.push('/(home)/challenges/create')} activeOpacity={0.8}>
            <Text style={[styles.quickLabel, styles.quickLabelPrimary]}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingBottom: 24, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.lg },
  greeting: { fontSize: 10, color: colors.textDim, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4, fontWeight: '700' },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.accentBorder,
  },
  avatarText: { fontSize: 12, fontWeight: '800', color: colors.accent },

  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTag: { fontSize: 11, color: colors.textDim, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: '800', marginBottom: spacing.md, marginTop: spacing.xs },
  seeAll: { fontSize: 12, color: colors.accent, fontWeight: '700', marginBottom: spacing.md, marginTop: spacing.xs },

  stripWrap: { marginBottom: spacing.lg, marginHorizontal: -spacing.lg },
  strip: { paddingHorizontal: spacing.lg, gap: spacing.md },
  tile: {
    width: 160, backgroundColor: colors.card, borderRadius: radii.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  tileThumb: {
    width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.accentDark,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  tileEmoji: { fontSize: 24 },
  tileGoal: { fontSize: 13, fontWeight: '800', color: colors.textPrimary, lineHeight: 17, minHeight: 34 },
  tileStats: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 10 },
  tilePot: { fontSize: 15, fontWeight: '900', color: colors.accent },
  tilePlayers: { fontSize: 11, color: colors.textDim, fontWeight: '600' },

  emptyCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 20, alignItems: 'center', marginBottom: 10,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  emptyText: { color: colors.textDim, fontSize: 13, marginBottom: 8 },
  emptyLink: { color: colors.accent, fontSize: 13, fontWeight: '700' },

  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, marginBottom: 16 },
  quickBtn: {
    flex: 1, backgroundColor: colors.card, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderMid,
  },
  quickBtnPrimary: { backgroundColor: colors.accent, borderColor: colors.accent },
  quickLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  quickLabelPrimary: { color: colors.bg },
}));
