import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { radii } from '../../../constants/theme';
import { Profile, getPendingRequests, respondToFriendRequest, searchUsers, sendFriendRequest } from '../../../lib/api';
import { makeStyles, useTheme } from '../../../lib/theme';
import { guardGuest } from '../../../lib/guest';

export default function AddFriendsScreen() {
  const { colors } = useTheme();
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<Array<{ id: string; profiles: Profile }>>([]);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    getPendingRequests().then(setPending);
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    setSearching(true);
    const timer = setTimeout(() => {
      searchUsers(query).then(r => { setResults(r); setSearching(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAdd = async (userId: string) => {
    if (guardGuest('add friends')) return;
    setSent(prev => new Set(prev).add(userId));
    try {
      await sendFriendRequest(userId);
    } catch {
      setSent(prev => { const s = new Set(prev); s.delete(userId); return s; });
    }
  };

  const handleRespond = async (friendshipId: string, accept: boolean) => {
    if (guardGuest('respond to friend requests')) return;
    setDismissed(prev => new Set(prev).add(friendshipId));
    await respondToFriendRequest(friendshipId, accept);
  };

  const visiblePending = pending.filter(r => !dismissed.has(r.id));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <BackButton label="← Friends" />
        <Text style={styles.title}>Add friends</Text>

        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or @username"
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
          />
          {searching && <ActivityIndicator color={colors.accent} size="small" />}
        </View>

        {results.length > 0 && (
          <>
            <Text style={styles.sectionTag}>RESULTS</Text>
            <View style={styles.list}>
              {results.map(u => (
                <View key={u.id} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.av, styles.avDim]}>
                      <Text style={styles.avTextDim}>{u.initials}</Text>
                    </View>
                    <View>
                      <Text style={styles.rowName}>{u.name}</Text>
                      <Text style={styles.rowSub}>@{u.username}</Text>
                    </View>
                  </View>
                  {sent.has(u.id) ? (
                    <View style={styles.sentBadge}><Text style={styles.sentText}>Sent</Text></View>
                  ) : (
                    <TouchableOpacity style={styles.addBtn} onPress={() => handleAdd(u.id)}>
                      <Text style={styles.addBtnText}>Add</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {visiblePending.length > 0 && (
          <>
            <Text style={[styles.sectionTag, { marginTop: 16 }]}>PENDING REQUESTS</Text>
            <View style={styles.list}>
              {visiblePending.map(r => (
                <View key={r.id} style={styles.row}>
                  <View style={styles.rowLeft}>
                    <View style={[styles.av, styles.avGreen]}>
                      <Text style={styles.avTextGreen}>{r.profiles.initials}</Text>
                    </View>
                    <View>
                      <Text style={styles.rowName}>{r.profiles.name}</Text>
                      <Text style={[styles.rowSub, { color: colors.accent }]}>Wants to be friends</Text>
                    </View>
                  </View>
                  <View style={styles.actionPair}>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleRespond(r.id, true)}>
                      <Text style={styles.acceptText}>✓</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleRespond(r.id, false)}>
                      <Text style={styles.rejectText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {query.length === 0 && visiblePending.length === 0 && (
          <Text style={styles.hintText}>Search by name or username to find friends.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  scroll: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.input, borderRadius: radii.md,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 18,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: colors.borderLight, borderLeftColor: colors.borderMid,
    borderRightColor: colors.borderDark, borderBottomColor: colors.borderDarker,
  },
  searchIcon: { fontSize: 14 },
  searchInput: { flex: 1, color: colors.textSecondary, fontSize: 13, paddingVertical: 0 },
  sectionTag: { fontSize: 8, color: colors.textDim, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },
  list: { gap: 5 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.card, borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  av: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avGreen: {
    backgroundColor: colors.accentDark,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  avDim: {
    backgroundColor: colors.input,
    borderWidth: 1, borderColor: colors.borderMid,
  },
  avTextGreen: { fontSize: 9, fontWeight: '700', color: colors.accent },
  avTextDim: { fontSize: 9, fontWeight: '700', color: colors.textDim },
  rowName: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  rowSub: { fontSize: 9, color: colors.textMuted, marginTop: 1 },
  addBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { color: colors.bg, fontSize: 10, fontWeight: '800' },
  sentBadge: {
    backgroundColor: colors.input, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.borderLight,
  },
  sentText: { color: colors.textDim, fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  actionPair: { flexDirection: 'row', gap: 6 },
  acceptBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  rejectBtn: {
    backgroundColor: colors.input, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderWidth: 1, borderColor: colors.red,
  },
  rejectText: { color: colors.red, fontSize: 12, fontWeight: '800' },
  hintText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 32 },
}));
