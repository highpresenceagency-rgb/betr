import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GameCard from '../../../components/GameCard';
import { radii, spacing } from '../../../constants/theme';
import { Challenge, getMyActiveChallenges, getPublicFeed } from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';

export default function ChallengesScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
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

  const filtered = feed.filter((c) => c.goal.toLowerCase().includes(search.toLowerCase()));
  const open = (id: string) => router.push(`/(home)/challenges/${id}`);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>Discover</Text>
          <TouchableOpacity style={styles.createBtn} activeOpacity={0.85} onPress={() => router.push('/(home)/challenges/create')}>
            <Text style={styles.createBtnText}>+ Create</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search challenges…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Promo banner — original copy */}
        <View style={styles.promo}>
          <View style={styles.promoText}>
            <Text style={styles.promoTitle}>Bet on yourself</Text>
            <Text style={styles.promoSub}>Put points on a goal. Show daily video proof. Win your share of the pot.</Text>
          </View>
          <Image source={require('../../../assets/logo.png')} style={styles.promoLogo} />
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 40 }} />
        ) : (
          <>
            {mine.length > 0 && (
              <>
                <Text style={styles.section}>YOUR ACTIVE GAMES</Text>
                {mine.map((c) => <GameCard key={c.id} challenge={c} onPress={() => open(c.id)} />)}
              </>
            )}

            <Text style={styles.section}>PUBLIC FEED</Text>
            {filtered.length === 0 ? (
              <Text style={styles.empty}>{search ? 'No challenges match.' : 'No public challenges yet.'}</Text>
            ) : (
              filtered.map((c) => <GameCard key={c.id} challenge={c} onPress={() => open(c.id)} />)
            )}
          </>
        )}
        <View style={{ height: 16 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  title: { fontSize: 28, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  createBtn: { backgroundColor: colors.accent, borderRadius: radii.full, paddingHorizontal: spacing.md, paddingVertical: 8 },
  createBtnText: { color: colors.bg, fontSize: 13, fontWeight: '800' },

  searchWrap: {
    backgroundColor: colors.input, borderRadius: radii.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  searchInput: { paddingHorizontal: spacing.md, paddingVertical: 11, fontSize: 14, color: colors.textPrimary },

  promo: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.accent, borderRadius: radii.lg,
    padding: spacing.lg, marginBottom: spacing.xl, overflow: 'hidden',
  },
  promoText: { flex: 1, paddingRight: spacing.md },
  promoTitle: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4 },
  promoSub: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },
  promoLogo: { width: 64, height: 64, borderRadius: 16 },

  section: {
    fontSize: 11, color: colors.textDim, letterSpacing: 1.2, textTransform: 'uppercase',
    fontWeight: '800', marginBottom: spacing.md, marginTop: spacing.xs,
  },
  empty: { color: colors.textDim, fontSize: 14, textAlign: 'center', paddingVertical: spacing.xl },
}));
