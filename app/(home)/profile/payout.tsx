import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../../../components/Button';
import { radii } from '../../../constants/theme';
import { makeStyles, useTheme } from '../../../lib/theme';

export default function PayoutScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    challengeName?: string;
    betAmount?: string;
    winnings?: string;
    creatorFee?: string;
  }>();

  const challengeName = params.challengeName ?? 'Challenge';
  const betAmount = Number(params.betAmount ?? 0);
  const winnings = Number(params.winnings ?? 0);
  const creatorFee = Number(params.creatorFee ?? 0);
  const total = betAmount + winnings;

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.starRing}>
          <Text style={styles.star}>★</Text>
        </View>

        <Text style={styles.tag}>CHALLENGE COMPLETE</Text>
        <Text style={styles.title}>You won!</Text>
        <Text style={styles.challengeName}>{challengeName}</Text>

        <View style={styles.breakdownCard}>
          <Text style={styles.sectionTag}>PAYOUT BREAKDOWN</Text>

          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Your bet returned</Text>
            <Text style={styles.breakdownVal}>${betAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.shimmer} />

          <View style={styles.breakdownRow}>
            <View style={styles.breakdownLabelWrap}>
              <Text style={styles.breakdownLabel}>Winner share</Text>
              <Text style={styles.breakdownSub}>Split from losing pool</Text>
            </View>
            <Text style={styles.breakdownVal}>+${winnings.toFixed(2)}</Text>
          </View>

          {creatorFee > 0 && (
            <View style={styles.breakdownRow}>
              <View style={styles.breakdownLabelWrap}>
                <Text style={[styles.breakdownLabel, { color: colors.textDim }]}>Creator fee</Text>
                <Text style={styles.breakdownSub}>deducted from pot</Text>
              </View>
              <Text style={[styles.breakdownVal, { color: colors.textDim }]}>−${creatorFee.toFixed(2)}</Text>
            </View>
          )}

          <View style={styles.shimmer} />

          <View style={styles.breakdownRow}>
            <Text style={styles.totalLabel}>Total payout</Text>
            <Text style={styles.totalVal}>${total.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.feeNote}>
          <Text style={styles.feeNoteText}>
            Bettr takes zero cut of your winnings. Challenge settlements are internal — no payment processing fees.
          </Text>
        </View>

        <PrimaryButton label={`Withdraw $${total.toFixed(2)} to bank →`} onPress={() => router.push('/(home)/wallet/')} />
        <View style={{ height: 10 }} />
        <TouchableOpacity style={styles.keepBtn} onPress={() => router.replace('/(home)/')}>
          <Text style={styles.keepBtnText}>Keep in wallet</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/(home)/challenges/create')} style={{ marginTop: 16 }}>
          <Text style={styles.newChallengeLink}>Start a new challenge →</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: 16, paddingTop: 32, paddingBottom: 40, alignItems: 'center' },

  starRing: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center', marginBottom: 16,
    borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
    borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB,
  },
  star: { fontSize: 32, color: colors.accent },
  tag: { fontSize: 8, color: '#2D6040', letterSpacing: 2, fontWeight: '700', marginBottom: 6 },
  title: { fontSize: 32, fontWeight: '900', color: colors.textPrimary, marginBottom: 4 },
  challengeName: { fontSize: 13, color: colors.textMuted, marginBottom: 24 },

  breakdownCard: {
    width: '100%', backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 12,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  sectionTag: { fontSize: 8, color: colors.textDim, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 10 },
  shimmer: { height: 1, backgroundColor: colors.borderMid, marginVertical: 8 },

  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 3 },
  breakdownLabelWrap: { flex: 1, marginRight: 8 },
  breakdownLabel: { fontSize: 12, color: colors.textSecondary },
  breakdownSub: { fontSize: 9, color: colors.textMuted, marginTop: 1 },
  breakdownVal: { fontSize: 13, fontWeight: '800', color: colors.accent },

  totalLabel: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  totalVal: { fontSize: 20, fontWeight: '900', color: colors.accent },

  feeNote: {
    width: '100%', backgroundColor: colors.card, borderRadius: radii.md, padding: 10, marginBottom: 20,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  feeNoteText: { fontSize: 9, color: colors.textMuted, lineHeight: 14, textAlign: 'center' },

  keepBtn: {
    width: '100%', paddingVertical: 12, borderRadius: radii.md, alignItems: 'center',
    backgroundColor: colors.input,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  keepBtnText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  newChallengeLink: { fontSize: 12, color: colors.accent, fontWeight: '600' },
}));
