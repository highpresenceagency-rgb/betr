import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { radii } from '../../../constants/theme';
import { Transaction, getMyTransactions } from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';

export default function HistoryScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMyTransactions().then(t => { setTransactions(t); setLoading(false); });
  }, []);

  const winTxs = transactions.filter(t => t.type === 'win');
  const lossTxs = transactions.filter(t => t.type === 'challenge_join');
  const totalWon = winTxs.reduce((s, t) => s + t.amount, 0);
  const totalLost = lossTxs.reduce((s, t) => s + t.amount, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <BackButton />
        <Text style={styles.title}>History</Text>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 24 }} />
        ) : (
          <>
            <View style={styles.statsRow}>
              <View style={styles.statBadge}>
                <Text style={[styles.statVal, { color: colors.accent }]}>${totalWon.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Total won</Text>
              </View>
              <View style={styles.statBadge}>
                <Text style={[styles.statVal, { color: colors.red }]}>${totalLost.toFixed(0)}</Text>
                <Text style={styles.statLabel}>Total staked</Text>
              </View>
              <View style={styles.statBadge}>
                <Text style={[styles.statVal, { color: colors.textPrimary }]}>{transactions.length}</Text>
                <Text style={styles.statLabel}>Transactions</Text>
              </View>
            </View>

            <Text style={styles.sectionTag}>TRANSACTION HISTORY</Text>

            {transactions.length === 0 ? (
              <Text style={styles.emptyText}>No transactions yet.</Text>
            ) : (
              <View style={styles.list}>
                {transactions.map(tx => {
                  const isPos = tx.type === 'deposit' || tx.type === 'win' || tx.type === 'refund';
                  const badgeLabel = tx.type === 'win' ? 'Won'
                    : tx.type === 'deposit' ? 'Deposit'
                    : tx.type === 'refund' ? 'Refund'
                    : tx.type === 'withdrawal' ? 'Withdrawal'
                    : 'Joined';
                  return (
                    <View key={tx.id} style={styles.histCard}>
                      <View style={styles.histTop}>
                        <Text style={[styles.histDesc, !isPos && styles.histDescDim]}>{tx.description}</Text>
                        <Text style={[styles.histAmt, isPos ? styles.amtPos : styles.amtNeg]}>
                          {isPos ? '+' : '−'}${Math.abs(tx.amount).toFixed(2)}
                        </Text>
                      </View>
                      <View style={styles.histBottom}>
                        <Text style={styles.histDate}>
                          {new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </Text>
                        <View style={[styles.badge, isPos ? styles.badgeWon : styles.badgeLost]}>
                          <View style={[styles.badgeDot, isPos ? styles.dotGreen : styles.dotRed]} />
                          <Text style={[styles.badgeText, isPos ? styles.badgeTextWon : styles.badgeTextLost]}>
                            {badgeLabel}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  statBadge: {
    flex: 1, backgroundColor: colors.input, borderRadius: radii.md,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderMid,
  },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 8, color: colors.textMuted, marginTop: 2 },
  sectionTag: { fontSize: 8, color: colors.textDim, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },
  list: { gap: 6 },
  histCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 12,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  histTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5 },
  histDesc: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, flex: 1, marginRight: 8 },
  histDescDim: { color: colors.textDim },
  histAmt: { fontSize: 13, fontWeight: '700' },
  amtPos: { color: colors.accent },
  amtNeg: { color: colors.red },
  histBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  histDate: { fontSize: 9, color: colors.textMuted },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1,
  },
  badgeWon: { backgroundColor: colors.accentDark, borderColor: colors.accentBorder },
  badgeLost: { backgroundColor: '#1A0808', borderColor: '#3A1A1A' },
  badgeDot: { width: 4, height: 4, borderRadius: 2 },
  dotGreen: { backgroundColor: colors.accent },
  dotRed: { backgroundColor: colors.red },
  badgeText: { fontSize: 8, fontWeight: '700' },
  badgeTextWon: { color: colors.accent },
  badgeTextLost: { color: colors.red },
  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 24 },
}));
