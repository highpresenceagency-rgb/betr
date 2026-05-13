import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { colors, radii } from '../../../constants/theme';
import { Profile, getPendingRequests, respondToFriendRequest, searchUsers, sendFriendRequest } from '../../../lib/api';

export default function AddFriendsScreen() {
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
    setSent(prev => new Set(prev).add(userId));
    try {
      await sendFriendRequest(userId);
    } catch {
      setSent(prev => { const s = new Set(prev); s.delete(userId); return s; });
    }
  };

  const handleRespond = async (friendshipId: string, accept: boolean) => {
    setDismissed(prev => new Set(prev).add(friendshipId));
    await respondToFriendRequest(friendshipId, accept);
  };

  const visiblePending = pending.filter(r => !dismissed.has(r.id));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
  sectionTag: { fontSize: 8, color: '#3A3A3A', letterSpacing: 2, textTransform: 'uppercase', fontWeight: '700', marginBottom: 8 },
  list: { gap: 5 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#262626', borderLeftColor: '#202020', borderRightColor: '#0D0D0D', borderBottomColor: '#080808',
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  av: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  avGreen: {
    backgroundColor: colors.accentDark,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#3A7A45', borderLeftColor: '#2A6035', borderRightColor: '#0E1F12', borderBottomColor: '#091508',
  },
  avDim: {
    backgroundColor: '#141414',
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#252525', borderLeftColor: '#1E1E1E', borderRightColor: '#0D0D0D', borderBottomColor: '#080808',
  },
  avTextGreen: { fontSize: 9, fontWeight: '700', color: colors.accent },
  avTextDim: { fontSize: 9, fontWeight: '700', color: '#3A3A3A' },
  rowName: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  rowSub: { fontSize: 9, color: colors.textMuted, marginTop: 1 },
  addBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  addBtnText: { color: colors.bg, fontSize: 10, fontWeight: '800' },
  sentBadge: {
    backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#1E1E1E', borderLeftColor: '#1A1A1A', borderRightColor: '#0A0A0A', borderBottomColor: '#080808',
  },
  sentText: { color: '#444', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  actionPair: { flexDirection: 'row', gap: 6 },
  acceptBtn: { backgroundColor: colors.accent, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  acceptText: { color: colors.bg, fontSize: 12, fontWeight: '800' },
  rejectBtn: {
    backgroundColor: '#1A0808', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6,
    borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderBottomWidth: 1.5,
    borderTopColor: '#3A1A1A', borderLeftColor: '#2A1212', borderRightColor: '#0D0808', borderBottomColor: '#080404',
  },
  rejectText: { color: colors.red, fontSize: 12, fontWeight: '800' },
  hintText: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginTop: 32 },
});
