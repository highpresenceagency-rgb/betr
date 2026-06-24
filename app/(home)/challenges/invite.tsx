import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { GhostButton, PrimaryButton } from '../../../components/Button';
import { radii } from '../../../constants/theme';
import { getChallengeParticipants, Participant } from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';

export default function InviteScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const { goal, challengeId } = useLocalSearchParams<{ goal?: string; challengeId?: string }>();
  const [participants, setParticipants] = useState<Participant[]>([]);

  const inviteCode = challengeId ? challengeId.replace(/-/g, '').toUpperCase().slice(0, 6) : '------';
  const inviteUrl = `bettrr.app/join/${inviteCode}`;

  useEffect(() => {
    if (!challengeId) return;
    getChallengeParticipants(challengeId).then(setParticipants);
  }, [challengeId]);

  const handleCopy = useCallback(async () => {
    try {
      await Share.share({ message: inviteUrl });
    } catch {
      // user dismissed
    }
  }, [inviteUrl]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({ message: `Join my challenge on Bettrr! ${inviteUrl}` });
    } catch {
      // user dismissed
    }
  }, [inviteUrl]);

  const codeChars = inviteCode.split('');

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <BackButton label="← Challenges" />
        <Text style={styles.title}>Invite friends</Text>
        <Text style={styles.sub}>{goal ? goal.toUpperCase() : 'YOUR CHALLENGE'}</Text>

        {/* QR Code placeholder */}
        <View style={styles.qrCard}>
          <View style={styles.qrBox}>
            <View style={[styles.qrCorner, { top: 6, left: 6 }]} />
            <View style={[styles.qrCorner, { top: 6, right: 6 }]} />
            <View style={[styles.qrCorner, { bottom: 6, left: 6 }]} />
            {[...Array(6)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.qrDot,
                  {
                    top: 20 + Math.floor(i / 3) * 18,
                    left: 40 + (i % 3) * 14,
                    backgroundColor: i % 2 === 0 ? colors.accent : colors.borderMid,
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.scanText}>SCAN TO JOIN</Text>
        </View>

        {/* Invite code */}
        <Text style={styles.codeLabel}>INVITE CODE</Text>
        <View style={styles.codeRow}>
          {codeChars.map((char, i) => (
            <View key={i} style={styles.codeBox}>
              <Text style={styles.codeChar}>{char}</Text>
            </View>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          <PrimaryButton label="Copy link" onPress={handleCopy} style={{ flex: 1 }} />
          <View style={{ width: 8 }} />
          <GhostButton label="Share" onPress={handleShare} style={{ flex: 1 }} />
        </View>

        {/* Already joined */}
        {participants.length > 0 && (
          <>
            <Text style={styles.joinedLabel}>ALREADY JOINED ({participants.length})</Text>
            <View style={styles.joinedRow}>
              {participants.slice(0, 8).map((p, i) => (
                <View key={i} style={styles.joinedAv}>
                  <Text style={styles.joinedAvText}>{p.profiles.initials}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 20 }} />
        <TouchableOpacity
          onPress={() => router.replace('/(home)/challenges/')}
          style={styles.doneBtn}
        >
          <Text style={styles.doneBtnText}>Done → Go to challenges</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40, alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 2, alignSelf: 'flex-start' },
  sub: { fontSize: 8, color: colors.textMuted, letterSpacing: 1.5, marginBottom: 24, alignSelf: 'flex-start' },

  qrCard: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 18,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  qrBox: {
    width: 120, height: 120,
    backgroundColor: colors.input,
    borderRadius: radii.sm,
    borderWidth: 1, borderColor: colors.borderMid,
    overflow: 'hidden',
  },
  qrCorner: {
    position: 'absolute',
    width: 22,
    height: 22,
    backgroundColor: colors.borderMid,
    borderRadius: 3,
  },
  qrDot: { position: 'absolute', width: 7, height: 7, borderRadius: 1.5 },
  scanText: {
    fontSize: 9, color: colors.textMuted, letterSpacing: 1.5, textTransform: 'uppercase',
  },

  codeLabel: {
    fontSize: 9, color: colors.textDim, letterSpacing: 2, textTransform: 'uppercase',
    marginBottom: 8, fontWeight: '600',
  },
  codeRow: { flexDirection: 'row', gap: 6, marginBottom: 18 },
  codeBox: {
    width: 42, height: 48,
    backgroundColor: colors.input,
    borderRadius: radii.sm,
    alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.borderDark, borderBottomColor: colors.borderDarker,
  },
  codeChar: { fontSize: 20, fontWeight: '800', color: colors.accent },

  actionRow: { flexDirection: 'row', width: '100%', marginBottom: 24 },

  joinedLabel: {
    fontSize: 9, color: colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase',
    marginBottom: 8, fontWeight: '600',
  },
  joinedRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  joinedAv: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accentDark,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB,
  },
  joinedAvText: { fontSize: 10, fontWeight: '700', color: colors.accent },

  doneBtn: { paddingVertical: 6 },
  doneBtnText: { color: colors.accent, fontSize: 13, fontWeight: '600' },
}));
