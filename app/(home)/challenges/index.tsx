import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../../../constants/theme';
import { Challenge, daysLeft, effectiveStatus, getMyActiveChallenges, getPublicFeed, startsIn } from '../../../lib/api';

export default function ChallengesScreen() {
  const [mine, setMine] = useState<Challenge[]>([]);
  const [feed, setFeed] = useState<Challenge[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([getMyActiveChallenges(), getPublicFeed()]).then(([m, f]) => {
        if (!active) return;
        setMine(m);
        setFeed(f);
        setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const filtered = feed.filter(c => c.goal.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <Text style={styles.title}>Challenges</Text>
          <TouchableOpacity style={styles.createBtn} activeOpacity={0.8} onPress={() => router.push('/(home)/challenges/create')}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search challenges..."
            placeholderTextColor="#333"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
        ) : (
          <>
            {mine.length > 0 && (
              <>
                <Text style={styles.sectionTag}>YOUR ACTIVE</Text>
                {mine.map(c => {
                  const status = effectiveStatus(c);
                  return (
                    <TouchableOpacity key={c.id} style={styles.myCard} activeOpacity={0.88} onPress={() => router.push(`/(home)/challenges/${c.id}`)}>
                      <View style={styles.myCardTop}>
                        <View style={[styles.livePill, status === 'pending' && styles.livePillDim]}>
                          <View style={[styles.liveDot, { backgroundColor: status === 'voting' ? colors.amber : status === 'pending' ? '#555' : colors.accent }]} />
                          <Text style={[styles.livePillText, status === 'pending' && styles.livePillTextDim]}>{status === 'voting' ? 'Voting' : status === 'pending' ? 'Soon' : 'Live'}</Text>
                        </View>
                        <Text style={styles.myCardType}>{c.type === 'private' ? '🔒 Private' : '🌐 Public'}</Text>
                      </View>
                      <Text style={styles.myCardGoal}>{c.goal}</Text>
                      <View style={styles.shimmer} />
                      <View style={styles.myCardStats}>
                        <View style={styles.stat}><Text style={styles.statVal}>${c.pot.toFixed(0)}</Text><Text style={styles.statLabel}>Pot</Text></View>
                        <View style={styles.stat}><Text style={styles.statVal}>${c.bet_amount}</Text><Text style={styles.statLabel}>Bet</Text></View>
                        <View style={styles.stat}><Text style={styles.statVal}>{daysLeft(c.ends_at)}d</Text><Text style={styles.statLabel}>Left</Text></View>
                        <View style={styles.stat}><Text style={styles.statVal}>{c.participant_count}</Text><Text style={styles.statLabel}>Players</Text></View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </>
            )}

            <Text style={[styles.sectionTag, mine.length > 0 && { marginTop: 12 }]}>PUBLIC FEED</Text>

            {filtered.length === 0 ? (
              <View style={styles.empty}><Text style={styles.emptyText}>{search ? 'No challenges match.' : 'No public challenges yet.'}</Text></View>
            ) : (
              filtered.map(c => (
                <TouchableOpacity key={c.id} style={styles.feedCard} activeOpacity={0.88} onPress={() => router.push(`/(home)/challenges/${c.id}`)}>
                  <View style={styles.feedCardTop}>
                    <View style={styles.creatorAv}>
                      <Text style={styles.creatorAvText}>{c.profiles?.initials ?? '?'}</Text>
                    </View>
                    <View style={styles.creatorInfo}>
                      <Text style={styles.creatorName}>{c.profiles?.name ?? 'Unknown'}</Text>
                      <Text style={styles.creatorSub}>creator</Text>
                    </View>
                    <View style={styles.publicPill}><Text style={styles.publicPillText}>🌐 Public</Text></View>
                  </View>
                  <Text style={styles.feedCardGoal}>{c.goal}</Text>
                  <View style={styles.shimmer} />
                  <View style={styles.feedCardStats}>
                    <View style={styles.feedStat}><Text style={styles.feedStatVal}>${c.bet_amount}</Text><Text style={styles.feedStatLabel}>Bet</Text></View>
                    <View style={styles.feedStat}><Text style={styles.feedStatVal}>{c.participant_count}</Text><Text style={styles.feedStatLabel}>Joined</Text></View>
                    <View style={styles.feedStat}><Text style={styles.feedStatVal}>{startsIn(c.starts_at)}</Text><Text style={styles.feedStatLabel}>Starts in</Text></View>
                    {c.creator_fee_percent > 0 && (
                      <View style={styles.feedStat}><Text style={[styles.feedStatVal, { color: colors.textDim }]}>{c.creator_fee_percent}%</Text><Text style={styles.feedStatLabel}>Creator fee</Text></View>
                    )}
                  </View>
                  <TouchableOpacity style={styles.joinBtn} activeOpacity={0.8} onPress={() => router.push(`/(home)/challenges/${c.id}`)}>
                    <Text style={styles.joinBtnText}>Join for ${c.bet_amount} →</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  createBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  createBtnText: { color: colors.bg, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  searchWrap: { marginHorizontal: 16, marginBottom: 14, backgroundColor: '#111', borderRadius: radii.md, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808' },
  searchInput: { paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: colors.textPrimary },
  sectionTag: { fontSize: 8, color: '#3A3A3A', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8, paddingHorizontal: 16 },
  myCard: { marginHorizontal: 16, marginBottom: 8, backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A' },
  myCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentDark, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL, borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.accent },
  livePillText: { fontSize: 8, fontWeight: '700', color: colors.accent },
  livePillDim: { backgroundColor: '#111', borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808' },
  livePillTextDim: { color: '#555' },
  myCardType: { fontSize: 9, color: colors.textMuted },
  myCardGoal: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, lineHeight: 20 },
  shimmer: { height: 1, backgroundColor: '#2E2E2E', marginBottom: 10 },
  myCardStats: { flexDirection: 'row', gap: 6 },
  stat: { flex: 1, backgroundColor: '#111', borderRadius: 8, paddingVertical: 8, alignItems: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808' },
  statVal: { fontSize: 14, fontWeight: '800', color: colors.accent },
  statLabel: { fontSize: 8, color: '#333', marginTop: 2 },
  feedCard: { marginHorizontal: 16, marginBottom: 10, backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A' },
  feedCardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  creatorAv: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#1A1A1A', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#2A2A2A', borderLeftColor: '#242424', borderRightColor: '#111', borderBottomColor: '#0A0A0A' },
  creatorAvText: { fontSize: 8, fontWeight: '700', color: '#555' },
  creatorInfo: { flex: 1 },
  creatorName: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  creatorSub: { fontSize: 9, color: '#333' },
  publicPill: { backgroundColor: '#0F1A14', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#1E3025' },
  publicPillText: { fontSize: 9, color: '#3A6A4A' },
  feedCardGoal: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 10, lineHeight: 18 },
  feedCardStats: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  feedStat: { flex: 1, backgroundColor: '#111', borderRadius: 8, paddingVertical: 7, alignItems: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808' },
  feedStatVal: { fontSize: 12, fontWeight: '800', color: colors.accent },
  feedStatLabel: { fontSize: 8, color: '#333', marginTop: 2 },
  joinBtn: { backgroundColor: colors.accentDark, borderRadius: radii.sm, paddingVertical: 10, alignItems: 'center', borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL, borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB },
  joinBtnText: { fontSize: 12, fontWeight: '700', color: colors.accent },
  empty: { marginHorizontal: 16, paddingVertical: 20, alignItems: 'center' },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
