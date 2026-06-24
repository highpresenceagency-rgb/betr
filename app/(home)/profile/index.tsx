import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii } from '../../../constants/theme';
import { Profile, ProfileStats, getMyProfile, getProfileStats } from '../../../lib/api';
import { exitGuestMode, useIsGuest } from '../../../lib/guest';
import { supabase } from '../../../lib/supabase';
import { makeStyles, useTheme } from '../../../lib/theme';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ won: 0, win_rate: 0, completed: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [friendActivity, setFriendActivity] = useState(false);
  const guest = useIsGuest();
  const { colors } = useTheme();
  const styles = useStyles();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([getMyProfile(), getProfileStats()]).then(([p, s]) => {
        if (!active) return;
        setProfile(p);
        setStats(s);
        setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.replace('/');
  };

  const handleExitGuest = async () => {
    await exitGuestMode();
    router.replace('/');
  };

  const statBadges = [
    { label: 'Won', value: `$${Number(stats.won).toFixed(0)}`, color: colors.accent },
    { label: 'Win rate', value: `${stats.win_rate}%`, color: colors.textPrimary },
    { label: 'Streak 🔥', value: `${stats.streak}`, color: colors.amber },
    { label: 'Completed', value: `${stats.completed}`, color: colors.textPrimary },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : guest ? (
          <View style={styles.guestCard}>
            <View style={styles.avatarLg}>
              <Text style={styles.avatarText}>?</Text>
            </View>
            <Text style={styles.guestTitle}>You're browsing as a guest</Text>
            <Text style={styles.guestSub}>
              Create an account to join challenges, bet on yourself, and track your wins.
            </Text>
            <TouchableOpacity
              style={styles.guestPrimaryBtn}
              onPress={() => router.push('/(auth)/sign-up/step-1')}
              activeOpacity={0.85}
            >
              <Text style={styles.guestPrimaryText}>Create account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.guestSecondaryBtn}
              onPress={() => router.push('/(auth)/sign-in')}
              activeOpacity={0.8}
            >
              <Text style={styles.guestSecondaryText}>Sign in</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.profileHeader}>
              <View style={styles.headerLeft}>
                <View style={styles.avatarLg}>
                  <Text style={styles.avatarText}>{profile?.initials ?? '??'}</Text>
                </View>
                <View>
                  <Text style={styles.name}>{profile?.name ?? ''}</Text>
                  <Text style={styles.username}>@{profile?.username ?? ''}</Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => Alert.alert('Edit profile', 'Coming soon!')}>
                <Text style={styles.editBtn}>Edit</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statsRow}>
              {statBadges.map(s => (
                <View key={s.label} style={styles.statBadge}>
                  <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTag}>SETTINGS</Text>
          <View style={styles.settingsList}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Push notifications</Text>
              <Switch
                value={notifs}
                onValueChange={setNotifs}
                trackColor={{ false: colors.input, true: colors.accent }}
                thumbColor={notifs ? '#fff' : colors.borderMid}
                ios_backgroundColor={colors.input}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Daily reminders</Text>
              <Switch
                value={reminders}
                onValueChange={setReminders}
                trackColor={{ false: colors.input, true: colors.accent }}
                thumbColor={reminders ? '#fff' : colors.borderMid}
                ios_backgroundColor={colors.input}
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Friend activity</Text>
              <Switch
                value={friendActivity}
                onValueChange={setFriendActivity}
                trackColor={{ false: colors.input, true: colors.accent }}
                thumbColor={friendActivity ? '#fff' : colors.borderMid}
                ios_backgroundColor={colors.input}
              />
            </View>
          </View>
        </View>

        <View style={styles.linksList}>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(home)/wallet/')}>
            <Text style={styles.linkLabel}>Wallet & payments</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(home)/profile/history')}>
            <Text style={styles.linkLabel}>Challenge history</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(home)/profile/settings')}>
            <Text style={styles.linkLabel}>Appearance & settings</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          {!guest && (
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(home)/profile/reviews')}>
              <Text style={styles.linkLabel}>Review queue</Text>
              <Text style={styles.linkArrow}>›</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/(home)/profile/faq')}>
            <Text style={styles.linkLabel}>Help & FAQ</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={guest ? handleExitGuest : handleSignOut}>
            <Text style={[styles.linkLabel, styles.signOutLabel]}>{guest ? 'Exit guest mode' : 'Sign out'}</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 },

  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarLg: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.accentBorder,
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.accent },

  guestCard: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 20, marginBottom: 12, alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderMid,
  },
  guestTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginTop: 12, marginBottom: 6 },
  guestSub: { fontSize: 12, color: colors.textDim, textAlign: 'center', lineHeight: 18, marginBottom: 16 },
  guestPrimaryBtn: {
    width: '100%', backgroundColor: colors.accent, borderRadius: radii.md, paddingVertical: 13, alignItems: 'center',
  },
  guestPrimaryText: { color: colors.bg, fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  guestSecondaryBtn: { paddingVertical: 14, alignItems: 'center' },
  guestSecondaryText: { color: colors.accent, fontSize: 12, fontWeight: '700' },

  name: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  username: { fontSize: 11, color: colors.accent, marginTop: 1 },
  editBtn: { fontSize: 12, color: colors.accent, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  statBadge: {
    flex: 1, backgroundColor: colors.card, borderRadius: radii.md,
    paddingVertical: 10, alignItems: 'center',
    borderWidth: 1, borderColor: colors.borderMid,
  },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, color: colors.textMuted, marginTop: 2 },

  card: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  sectionTag: { fontSize: 10, color: colors.textDim, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: '700', marginBottom: 10 },
  settingsList: { gap: 6 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.input, borderRadius: radii.md, paddingHorizontal: 12, paddingVertical: 9,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  settingLabel: { fontSize: 13, color: colors.textSecondary },

  linksList: { gap: 6 },
  linkRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: colors.card, borderRadius: radii.md, paddingHorizontal: 14, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  linkLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  signOutLabel: { color: colors.red },
  linkArrow: { fontSize: 18, color: colors.textDim },
}));
