import { router, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { radii } from '../../../constants/theme';
import { Profile, getMyFriends, getMyProfile } from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';

export default function FriendsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      Promise.all([getMyFriends(), getMyProfile()]).then(([f, p]) => {
        if (!active) return;
        setFriends(f);
        setMe(p);
        setLoading(false);
      });
      return () => { active = false; };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Friends</Text>
          <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/(home)/friends/add')}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 32 }} />
        ) : (
          <>
            <Text style={styles.sectionTag}>
              ALL FRIENDS ({friends.length})
            </Text>

            {me && (
              <View style={[styles.friendRow, { marginBottom: 5 }]}>
                <View style={styles.rowLeft}>
                  <View style={[styles.av, styles.avGreen]}>
                    <Text style={[styles.avText, styles.avTextGreen]}>{me.initials}</Text>
                  </View>
                  <View>
                    <Text style={styles.rowName}>You</Text>
                    <Text style={styles.friendSub}>@{me.username}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => router.push('/(home)/challenges/create')}>
                  <Text style={styles.challengeLink}>+ Challenge</Text>
                </TouchableOpacity>
              </View>
            )}

            {friends.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No friends yet.</Text>
                <TouchableOpacity onPress={() => router.push('/(home)/friends/add')}>
                  <Text style={styles.emptyLink}>Find friends →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              friends.map(f => (
                <View key={f.id} style={styles.friendRow}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.av, styles.avDim]}>
                      <Text style={[styles.avText, styles.avTextDim]}>{f.initials}</Text>
                    </View>
                    <View>
                      <Text style={styles.rowName}>{f.name}</Text>
                      <Text style={styles.friendSub}>@{f.username}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => router.push('/(home)/challenges/create')}>
                    <Text style={styles.challengeLink}>▶ Challenge</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  addBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: colors.bg, fontSize: 11, fontWeight: '800' },

  sectionTag: { fontSize: 8, color: colors.textDim, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },

  av: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  avGreen: {
    backgroundColor: colors.accentDark,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  avDim: {
    backgroundColor: colors.input,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  avText: { fontSize: 8, fontWeight: '700' },
  avTextGreen: { color: colors.accent },
  avTextDim: { color: colors.textDim },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },

  friendRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8,
    marginBottom: 5,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  friendSub: { fontSize: 9, color: colors.textMuted, marginTop: 1 },
  challengeLink: { fontSize: 11, color: colors.accent, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 24 },
  emptyText: { color: colors.textMuted, fontSize: 13, marginBottom: 8 },
  emptyLink: { color: colors.accent, fontSize: 13, fontWeight: '600' },
}));
