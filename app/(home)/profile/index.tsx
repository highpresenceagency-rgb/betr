import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii } from '../../../constants/theme';
import { Profile, ProfileStats, getMyProfile, getProfileStats } from '../../../lib/api';
import { supabase } from '../../../lib/supabase';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<ProfileStats>({ won: 0, win_rate: 0, completed: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [notifs, setNotifs] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [friendActivity, setFriendActivity] = useState(false);

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

  const statBadges = [
    { label: 'Won', value: `$${Number(stats.won).toFixed(0)}`, color: colors.accent },
    { label: 'Win rate', value: `${stats.win_rate}%`, color: colors.textPrimary },
    { label: 'Streak 🔥', value: `${stats.streak}`, color: colors.amber },
    { label: 'Completed', value: `${stats.completed}`, color: colors.textPrimary },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
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
                trackColor={{ false: '#141414', true: colors.accentDark }}
                thumbColor={notifs ? colors.accent : '#2A2A2A'}
                ios_backgroundColor="#141414"
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Daily reminders</Text>
              <Switch
                value={reminders}
                onValueChange={setReminders}
                trackColor={{ false: '#141414', true: colors.accentDark }}
                thumbColor={reminders ? colors.accent : '#2A2A2A'}
                ios_backgroundColor="#141414"
              />
            </View>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Friend activity</Text>
              <Switch
                value={friendActivity}
                onValueChange={setFriendActivity}
                trackColor={{ false: '#141414', true: colors.accentDark }}
                thumbColor={friendActivity ? colors.accent : '#2A2A2A'}
                ios_backgroundColor="#141414"
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
          <TouchableOpacity style={styles.linkRow} onPress={handleSignOut}>
            <Text style={[styles.linkLabel, styles.signOutLabel]}>Sign out</Text>
            <Text style={styles.linkArrow}>›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 },

  profileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarLg: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accentDark, alignItems: 'center', justifyContent: 'center',
    borderTopWidth: 2, borderLeftWidth: 2, borderRightWidth: 2, borderBottomWidth: 2,
    borderTopColor: colors.accentBorder, borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.accentBorderR, borderBottomColor: colors.accentBorderB,
  },
  avatarText: { fontSize: 20, fontWeight: '800', color: colors.accent },
  name: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  username: { fontSize: 11, color: colors.accent, marginTop: 1 },
  editBtn: { fontSize: 12, color: colors.accent, fontWeight: '600' },

  statsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  statBadge: {
    flex: 1, backgroundColor: colors.input, borderRadius: radii.md,
    paddingVertical: 10, alignItems: 'center',
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808',
  },
  statVal: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 8, color: colors.textMuted, marginTop: 2 },

  card: {
    backgroundColor: colors.card, borderRadius: radii.lg, padding: 14, marginBottom: 10,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#303030', borderLeftColor: '#2A2A2A', borderRightColor: '#111111', borderBottomColor: '#0A0A0A',
  },
  sectionTag: { fontSize: 8, color: '#3A3A3A', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 10 },
  settingsList: { gap: 5 },
  settingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808',
  },
  settingLabel: { fontSize: 12, color: colors.textSecondary },

  linksList: { gap: 5 },
  linkRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 12,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808',
  },
  linkLabel: { fontSize: 12, color: colors.textSecondary },
  signOutLabel: { color: colors.red },
  linkArrow: { fontSize: 16, color: '#3A3A3A' },
});
