import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { radii } from '../../../constants/theme';
import { Transaction, Wallet, depositFunds, getMyTransactions, getMyWallet, requestWithdrawal } from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';
import { guardGuest } from '../../../lib/guest';

const DEPOSIT_AMOUNTS = [25, 50, 100, 250] as const;
const TABS = ['Deposit', 'Withdraw'] as const;

export default function WalletScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, locked_balance: 0 });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<typeof TABS[number]>('Deposit');
  const [selectedAmt, setSelectedAmt] = useState<number | null>(50);
  const [customAmt, setCustomAmt] = useState('');
  const [acting, setActing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([getMyWallet(), getMyTransactions()]).then(([w, t]) => {
        if (!active) return;
        setWallet(w);
        setTransactions(t);
        setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const rawAmount = customAmt ? Number(customAmt) : selectedAmt ?? 0;
  const amount = isNaN(rawAmount) || rawAmount < 0 ? 0 : rawAmount;

  const cardFee = amount > 0 ? (amount * 0.029 + 0.30).toFixed(2) : '0.00';
  const depositTotal = amount > 0 ? (amount + Number(cardFee)).toFixed(2) : '0.00';

  const handleDeposit = async () => {
    if (guardGuest('add funds')) return;
    if (amount <= 0) { Alert.alert('Enter an amount'); return; }
    setActing(true);
    try {
      await depositFunds(amount);
    } catch (e: unknown) {
      Alert.alert('Deposit failed', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setActing(false);
    }
  };

  const handleWithdraw = () => {
    if (guardGuest('withdraw funds')) return;
    if (amount <= 0) { Alert.alert('Enter an amount'); return; }
    if (amount < 5) { Alert.alert('Minimum withdrawal', 'Minimum withdrawal is $5.'); return; }
    if (amount > wallet.balance) { Alert.alert('Insufficient balance', `Your available balance is $${wallet.balance.toFixed(2)}.`); return; }
    Alert.alert(
      `Withdraw $${amount.toFixed(2)}?`,
      'Funds arrive in 2–3 business days. No fee.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActing(true);
            try {
              await requestWithdrawal(amount);
              const w = await getMyWallet();
              setWallet(w);
              Alert.alert('Withdrawal requested', 'Your request has been submitted. Funds typically arrive within 2–3 business days.');
            } catch (e: unknown) {
              Alert.alert('Withdrawal failed', e instanceof Error ? e.message : 'Unknown error');
            } finally {
              setActing(false);
            }
          },
        },
      ],
    );
  };

  const isDebit = (type: string) => type === 'challenge_join' || type === 'withdrawal';

  const txIcon = (type: string) => {
    if (type === 'deposit' || type === 'refund') return '+';
    if (type === 'win') return '★';
    if (type === 'withdrawal') return '↑';
    return '−';
  };
  const txColor = (type: string) => {
    if (type === 'deposit' || type === 'win' || type === 'refund') return colors.accent;
    return colors.red;
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

        <View style={styles.balanceCard}>
          <Text style={styles.balanceTag}>AVAILABLE BALANCE</Text>
          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginVertical: 10 }} />
          ) : (
            <Text style={styles.balanceAmt}>${wallet.balance.toFixed(2)}</Text>
          )}
          <View style={styles.shimmer} />
          <View style={styles.lockedRow}>
            <Text style={styles.lockedLabel}>Locked in challenges</Text>
            <Text style={styles.lockedAmt}>${wallet.locked_balance.toFixed(2)}</Text>
          </View>
        </View>

        <View style={styles.tabRow}>
          {TABS.map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && styles.tabBtnActive]}
              onPress={() => setTab(t)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabBtnText, tab === t && styles.tabBtnTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTag}>AMOUNT</Text>
        <View style={styles.amountRow}>
          {DEPOSIT_AMOUNTS.map(a => (
            <TouchableOpacity
              key={a}
              style={[styles.amtChip, selectedAmt === a && !customAmt && styles.amtChipActive]}
              onPress={() => { setSelectedAmt(a); setCustomAmt(''); }}
              activeOpacity={0.8}
            >
              <Text style={[styles.amtChipText, selectedAmt === a && !customAmt && styles.amtChipTextActive]}>${a}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.customWrap}>
          <Text style={styles.dollarSign}>$</Text>
          <TextInput
            style={styles.customInput}
            placeholder="Custom amount"
            placeholderTextColor={colors.textMuted}
            value={customAmt}
            onChangeText={t => { setCustomAmt(t.replace(/[^0-9.]/g, '')); setSelectedAmt(null); }}
            keyboardType="decimal-pad"
          />
        </View>

        {tab === 'Deposit' ? (
          <>
            {amount > 0 && (
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Deposit amount</Text>
                  <Text style={styles.summaryVal}>${amount.toFixed(2)}</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Card fee (2.9% + $0.30)</Text>
                  <Text style={styles.summaryVal}>${cardFee}</Text>
                </View>
                <View style={styles.shimmer} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabelBold}>Total charged</Text>
                  <Text style={[styles.summaryVal, { color: colors.accent }]}>${depositTotal}</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.actionBtn} onPress={handleDeposit} activeOpacity={0.85} disabled={acting}>
              <Text style={styles.actionBtnText}>{acting ? 'Opening…' : `Deposit $${amount > 0 ? amount.toFixed(2) : '—'} →`}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.withdrawNote}>
              <Text style={styles.withdrawNoteText}>Free · arrives in 2–3 business days</Text>
            </View>

            <TouchableOpacity style={styles.actionBtn} onPress={handleWithdraw} activeOpacity={0.85} disabled={acting}>
              <Text style={styles.actionBtnText}>{acting ? 'Processing…' : `Withdraw $${amount > 0 ? amount.toFixed(2) : '—'} →`}</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={[styles.sectionTag, { marginTop: 24 }]}>RECENT TRANSACTIONS</Text>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
        ) : transactions.length === 0 ? (
          <Text style={styles.emptyText}>No transactions yet.</Text>
        ) : (
          transactions.map(tx => (
            <View key={tx.id} style={styles.txRow}>
              <View style={[styles.txIcon, { backgroundColor: isDebit(tx.type) ? colors.cardInner : colors.accentDark }]}>
                <Text style={[styles.txIconText, { color: txColor(tx.type) }]}>{txIcon(tx.type)}</Text>
              </View>
              <View style={styles.txInfo}>
                <Text style={styles.txDesc}>{tx.description}</Text>
                <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
              </View>
              <Text style={[styles.txAmt, { color: txColor(tx.type) }]}>
                {isDebit(tx.type) ? '-' : '+'}${Math.abs(tx.amount).toFixed(2)}
              </Text>
            </View>
          ))
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingBottom: 32, paddingTop: 12 },

  balanceCard: {
    margin: 16, backgroundColor: colors.card, borderRadius: radii.lg, padding: 16,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  balanceTag: { fontSize: 10, color: colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700', marginBottom: 4 },
  balanceAmt: { fontSize: 44, fontWeight: '900', color: colors.accent, letterSpacing: -2, marginBottom: 10 },
  shimmer: { height: 1, backgroundColor: colors.borderMid, marginVertical: 8 },
  lockedRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  lockedLabel: { fontSize: 12, color: colors.textDim },
  lockedAmt: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  tabRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, gap: 8 },
  tabBtn: {
    flex: 1, paddingVertical: 11, borderRadius: radii.md, alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderMid,
  },
  tabBtnActive: { backgroundColor: colors.accentDark, borderColor: colors.accentBorder },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: colors.textDim },
  tabBtnTextActive: { color: colors.accent },

  sectionTag: { fontSize: 10, color: colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8, paddingHorizontal: 16 },

  amountRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 10 },
  amtChip: {
    flex: 1, paddingVertical: 11, borderRadius: radii.md, alignItems: 'center',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderMid,
  },
  amtChipActive: { backgroundColor: colors.accentDark, borderColor: colors.accentBorder },
  amtChipText: { fontSize: 14, fontWeight: '800', color: colors.textDim },
  amtChipTextActive: { color: colors.accent },

  customWrap: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: colors.input, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  dollarSign: { fontSize: 16, fontWeight: '800', color: colors.accent, marginRight: 6 },
  customInput: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.accent },

  withdrawNote: {
    marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: radii.md,
    backgroundColor: colors.cardInner, borderWidth: 1, borderColor: colors.borderLight,
  },
  withdrawNoteText: { fontSize: 12, color: colors.textDim, textAlign: 'center' },

  summaryCard: {
    marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: radii.md,
    backgroundColor: colors.cardInner, borderWidth: 1, borderColor: colors.borderLight,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  summaryLabel: { fontSize: 12, color: colors.textDim },
  summaryLabelBold: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  summaryVal: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  actionBtn: {
    marginHorizontal: 16, paddingVertical: 15, borderRadius: radii.md, alignItems: 'center',
    backgroundColor: colors.accent,
  },
  actionBtnText: { fontSize: 14, fontWeight: '900', color: colors.bg, letterSpacing: 0.5 },

  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginBottom: 6, padding: 10, borderRadius: radii.md,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borderMid,
  },
  txIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  txIconText: { fontSize: 12, fontWeight: '800' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  txDate: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  txAmt: { fontSize: 13, fontWeight: '800' },

  emptyText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 12, paddingHorizontal: 16 },
}));
