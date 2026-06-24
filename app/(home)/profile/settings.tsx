import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { PALETTE_META, radii, spacing } from '../../../constants/theme';
import { makeStyles, useTheme } from '../../../lib/theme';

export default function Settings() {
  const styles = useStyles();
  const { colors, name, setTheme, mode, setMode } = useTheme();

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton />
        <Text style={styles.title}>Settings</Text>

        {/* ─── Appearance ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <Text style={styles.sectionHint}>Choose light or dark, then your accent. Applies instantly.</Text>

        <View style={styles.modeRow}>
          {(['dark', 'light'] as const).map((m) => {
            const on = mode === m;
            return (
              <TouchableOpacity
                key={m}
                activeOpacity={0.85}
                onPress={() => setMode(m)}
                style={[styles.modeBtn, on && styles.modeBtnOn]}
              >
                <Ionicons name={m === 'dark' ? 'moon' : 'sunny'} size={16} color={on ? colors.bg : colors.textSecondary} />
                <Text style={[styles.modeBtnText, { color: on ? colors.bg : colors.textSecondary }]}>
                  {m === 'dark' ? 'Dark' : 'Light'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          {PALETTE_META.map((p, i) => {
            const selected = p.name === name;
            return (
              <TouchableOpacity
                key={p.name}
                activeOpacity={0.8}
                onPress={() => setTheme(p.name)}
                style={[styles.row, i < PALETTE_META.length - 1 && styles.rowDivider]}
              >
                <View style={[styles.swatch, { backgroundColor: p.swatch }]} />
                <Text style={styles.rowLabel}>{p.label}</Text>
                {selected ? (
                  <Ionicons name="checkmark-circle" size={22} color={colors.accent} />
                ) : (
                  <View style={styles.radioEmpty} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* preview chip so the choice feels concrete */}
        <View style={styles.previewRow}>
          <View style={[styles.previewChip, { backgroundColor: colors.accent }]}>
            <Text style={[styles.previewChipText, { color: colors.bg }]}>Aa</Text>
          </View>
          <View style={[styles.previewChipGhost, { borderColor: colors.accentBorder }]}>
            <Text style={[styles.previewChipText, { color: colors.accent }]}>Accent</Text>
          </View>
        </View>

        {/* ─── Verification ───────────────────────────────────────── */}
        <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>Verification</Text>
        <View style={styles.card}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/(home)/profile/reviews')}
            style={[styles.row, styles.rowDivider]}
          >
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>Review queue</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textDim} />
          </TouchableOpacity>
          <View style={styles.row}>
            <Ionicons name="flag-outline" size={20} color={colors.textSecondary} />
            <Text style={styles.rowLabel}>Flagging is one-tap & weighted</Text>
          </View>
        </View>

        <Text style={styles.footnote}>
          Themes only change colors — your games, points, and proof history stay the same.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: colors.bgPage },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { color: colors.textPrimary, fontSize: 26, fontWeight: '900', marginBottom: spacing.lg },
  sectionLabel: {
    color: colors.textDim, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4,
  },
  sectionHint: { color: colors.textDim, fontSize: 12, marginBottom: spacing.md },
  modeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  modeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 12, borderRadius: radii.md,
    backgroundColor: colors.input, borderWidth: 1, borderColor: colors.borderLight,
  },
  modeBtnOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  modeBtnText: { fontWeight: '800', fontSize: 14 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.borderMid,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.borderDark },
  rowLabel: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  swatch: { width: 26, height: 26, borderRadius: radii.full, borderWidth: 1, borderColor: colors.borderLight },
  radioEmpty: {
    width: 20, height: 20, borderRadius: radii.full,
    borderWidth: 2, borderColor: colors.borderLight,
  },
  previewRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  previewChip: {
    width: 44, height: 44, borderRadius: radii.md,
    alignItems: 'center', justifyContent: 'center',
  },
  previewChipGhost: {
    paddingHorizontal: spacing.lg, height: 44, borderRadius: radii.md,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
  },
  previewChipText: { fontWeight: '800', fontSize: 14, letterSpacing: 0.5 },
  footnote: { color: colors.textDim, fontSize: 12, marginTop: spacing.xl, lineHeight: 18 },
}));
