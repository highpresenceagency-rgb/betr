import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';
import { radii, spacing } from '../constants/theme';
import { getProofUrl } from '../lib/api';
import { makeStyles, useTheme } from '../lib/theme';

// "Watch" button that fetches a short-lived signed URL (RLS-checked server-side)
// and plays the clip in a modal. Used by the group feed and the reviewer queue.
export default function ProofPlayer({ submissionId }: { submissionId: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const player = useVideoPlayer(null, (p) => { p.loop = true; });

  async function watch() {
    setLoading(true);
    const url = await getProofUrl(submissionId);
    setLoading(false);
    if (!url) { Alert.alert('Unavailable', 'Could not load this clip.'); return; }
    player.replace(url);
    player.play();
    setOpen(true);
  }

  function close() { player.pause(); setOpen(false); }

  return (
    <>
      <TouchableOpacity onPress={watch} style={styles.btn} activeOpacity={0.8} disabled={loading}>
        {loading
          ? <ActivityIndicator color={colors.accent} size="small" />
          : <Ionicons name="play-circle" size={18} color={colors.accent} />}
        <Text style={styles.btnText}>Watch</Text>
      </TouchableOpacity>

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <View style={styles.modal}>
          <VideoView player={player} style={styles.video} contentFit="contain" nativeControls />
          <Pressable onPress={close} style={styles.close} hitSlop={12}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>
      </Modal>
    </>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: spacing.md,
    backgroundColor: colors.accentDark, borderRadius: radii.full,
    borderWidth: 1, borderColor: colors.accentBorder,
  },
  btnText: { color: colors.accent, fontSize: 13, fontWeight: '700' },
  modal: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video: { width: '100%', height: '80%' },
  close: { position: 'absolute', top: 48, right: spacing.lg },
}));
