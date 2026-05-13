import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Logo from '../../components/Logo';
import { colors, radii } from '../../constants/theme';
import { Challenge, Profile, daysLeft, effectiveStatus, getMyActiveChallenges, getMyProfile } from '../../lib/api';

export default function HomeScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getMyProfile(), getMyActiveChallenges()]).then(([p, c]) => {
        if (!active) return;
        setProfile(p);
        setChallenges(c);
        setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const initials = profile?.initials ?? '??';
  const firstName = profile?.name?.split(' ')[0] ?? '';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
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

        <Text style={styles.sectionTag}>YOUR ACTIVE CHALLENGES</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
        ) : challenges.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active challenges.</Text>
            <TouchableOpacity onPress={() => router.push('/(home)/challenges/')}>
              <Text style={styles.emptyLink}>Browse challenges →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          challenges.map(c => {
            const status = effectiveStatus(c);
            const left = daysLeft(c.ends_at);
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.challengeCard}
                activeOpacity={0.88}
                onPress={() => router.push(`/(home)/challenges/${c.id}`)}
              >
                <View style={styles.challengeTop}>
                  <View style={[styles.livePill, status === 'pending' && styles.livePillDim]}>
                    <View style={[styles.liveDot, { backgroundColor: status === 'voting' ? colors.amber : status === 'pending' ? '#555' : colors.accent }]} />
                    <Text style={[styles.liveText, status === 'pending' && styles.liveTextDim]}>{status === 'voting' ? 'Voting' : status === 'pending' ? 'Soon' : 'Live'}</Text>
                  </View>
                  <Text style={styles.typePill}>{c.type === 'private' ? '🔒 Private' : '🌐 Public'}</Text>
                </View>
                <Text style={styles.challengeGoal}>{c.goal}</Text>
                <View style={styles.shimmer} />
                <View style={styles.challengeStats}>
                  <View style={styles.stat}>
                    <Text style={styles.statVal}>${c.pot.toFixed(0)}</Text>
                    <Text style={styles.statLabel}>Pot</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statVal}>${c.bet_amount}</Text>
                    <Text style={styles.statLabel}>Your bet</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statVal}>{left}d</Text>
                    <Text style={styles.statLabel}>Left</Text>
                  </View>
                  <View style={styles.stat}>
                    <Text style={styles.statVal}>{c.participant_count}</Text>
                    <Text style={styles.statLabel}>Players</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(home)/challenges/')} activeOpacity={0.8}>
            <Text style={styles.quickLabel}>Browse feed</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(home)/challenges/create')} activeOpacity={0.8}>
            <Text style={styles.quickLabel}>+ Create</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  greeting: { fontSize: 9, color: '#3A3A3A', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 2 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL, borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB },
  avatarText: { fontSize: 11, fontWeight: '800', color: colors.accent },
  sectionTag: { fontSize: 8, color: '#3A3A3A', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8, paddingHorizontal: 16 },
  emptyCard: { marginHorizontal: 16, backgroundColor: colors.card, borderRadius: radii.lg, padding: 20, alignItems: 'center', marginBottom: 10, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A' },
  emptyText: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  emptyLink: { color: colors.accent, fontSize: 13, fontWeight: '600' },
  challengeCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A' },
  challengeTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentDark, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL, borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
  liveText: { fontSize: 8, fontWeight: '700', color: colors.accent },
  livePillDim: { backgroundColor: '#111', borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808' },
  liveTextDim: { color: '#555' },
  typePill: { fontSize: 9, color: colors.textMuted },
  challengeGoal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, lineHeight: 20 },
  shimmer: { height: 1, backgroundColor: '#2E2E2E', marginBottom: 10 },
  challengeStats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, backgroundColor: '#111', borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808' },
  statVal: { fontSize: 14, fontWeight: '800', color: colors.accent },
  statLabel: { fontSize: 8, color: '#333', marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 8, marginBottom: 16 },
  quickBtn: { flex: 1, backgroundColor: colors.card, borderRadius: radii.sm, paddingVertical: 10, alignItems: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808' },
  quickLabel: { fontSize: 11, color: colors.accent, fontWeight: '600' },
});
