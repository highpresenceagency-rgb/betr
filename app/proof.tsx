import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton, GhostButton } from '../components/Button';
import { radii, spacing } from '../constants/theme';
import { getTodaySubmission, getTodayToken, submitProof, Submission } from '../lib/api';
import { makeStyles, useTheme } from '../lib/theme';

const MAX_SECONDS = 60;

export default function ProofScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const styles = useStyles();
  const { colors } = useTheme();

  const [camPerm, requestCam] = useCameraPermissions();
  const [micPerm, requestMic] = useMicrophonePermissions();
  const cameraRef = useRef<CameraView>(null);

  const [token, setToken] = useState<string | null>(null);
  const [existing, setExisting] = useState<Submission | null>(null);
  const [loading, setLoading] = useState(true);
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [clipUri, setClipUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const [t, sub] = await Promise.all([getTodayToken(id), getTodaySubmission(id)]);
      setToken(t);
      setExisting(sub);
      setLoading(false);
    })();
  }, [id]);

  // recording timer
  useEffect(() => {
    if (!recording) return;
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(iv);
  }, [recording]);

  const player = useVideoPlayer(clipUri, (p) => { p.loop = true; });
  useEffect(() => { if (clipUri) player.play(); }, [clipUri, player]);

  async function startRecording() {
    if (!cameraRef.current) return;
    setSeconds(0);
    setRecording(true);
    try {
      // Records IN-APP only — there is no gallery picker anywhere in this flow.
      const video = await cameraRef.current.recordAsync({ maxDuration: MAX_SECONDS });
      if (video?.uri) setClipUri(video.uri);
    } catch (e) {
      Alert.alert('Recording failed', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setRecording(false);
    }
  }

  function stopRecording() {
    cameraRef.current?.stopRecording();
  }

  async function submit() {
    if (!clipUri) return;
    setSubmitting(true);
    try {
      await submitProof(id, clipUri, seconds);
      Alert.alert('Submitted', 'Your proof is being verified. You’ll be notified once it’s reviewed.', [
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Could not submit', e instanceof Error ? e.message : 'Try again.');
      setSubmitting(false);
    }
  }

  // ─── Loading / already-submitted / permission gates ──────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.center}><ActivityIndicator color={colors.accent} /></SafeAreaView>
    );
  }

  if (existing && existing.status !== 'pending_ml') {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="checkmark-done-circle" size={56} color={colors.accent} />
        <Text style={styles.bigTitle}>Today’s proof is in</Text>
        <Text style={styles.dim}>Status: {existing.status.replace('_', ' ')}</Text>
        <View style={styles.gate}><GhostButton label="Close" onPress={() => router.back()} /></View>
      </SafeAreaView>
    );
  }

  if (!camPerm?.granted || !micPerm?.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Ionicons name="videocam-outline" size={56} color={colors.accent} />
        <Text style={styles.bigTitle}>Camera & mic needed</Text>
        <Text style={styles.dim}>
          Proof is recorded live in the app — say today’s code out loud so it can’t be a reused clip.
        </Text>
        <View style={styles.gate}>
          <PrimaryButton
            label="Allow camera & mic"
            onPress={async () => { await requestCam(); await requestMic(); }}
          />
          <View style={{ height: spacing.sm }} />
          <GhostButton label="Not now" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Preview the recorded clip before submitting ─────────────────────────
  if (clipUri) {
    return (
      <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
        <VideoView player={player} style={styles.preview} contentFit="cover" nativeControls={false} />
        <View style={styles.previewBar}>
          <Text style={styles.previewHint}>Did you say “{token ?? 'today’s code'}” at the start?</Text>
          <PrimaryButton label={submitting ? 'Submitting…' : 'Submit proof'} loading={submitting} onPress={submit} />
          <View style={{ height: spacing.sm }} />
          <GhostButton label="Retake" onPress={() => { setClipUri(null); setSeconds(0); }} />
        </View>
      </SafeAreaView>
    );
  }

  // ─── Live camera ─────────────────────────────────────────────────────────
  return (
    <View style={styles.page}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="video" />

      {/* token overlay */}
      <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
        <View style={styles.tokenCard}>
          <Text style={styles.tokenLabel}>SAY THIS OUT LOUD TO START</Text>
          <Text style={styles.tokenText}>{token ?? '…'}</Text>
          <Text style={styles.tokenSub}>Today’s anti-replay code</Text>
        </View>

        <View style={styles.controls}>
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.flip}
            disabled={recording}
          >
            <Ionicons name="camera-reverse-outline" size={26} color={colors.textPrimary} />
          </Pressable>

          <Pressable
            onPress={recording ? stopRecording : startRecording}
            style={[styles.shutter, recording && styles.shutterRec]}
          >
            <View style={[styles.shutterInner, recording && styles.shutterInnerRec]} />
          </Pressable>

          <View style={styles.flip}>
            {recording ? <Text style={styles.timer}>{seconds}s</Text> : null}
          </View>
        </View>

        <Pressable onPress={() => router.back()} style={styles.close} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.textPrimary} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  page: { flex: 1, backgroundColor: '#000' },
  center: {
    flex: 1, backgroundColor: colors.bgPage,
    alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm,
  },
  bigTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '900', marginTop: spacing.md, textAlign: 'center' },
  dim: { color: colors.textDim, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  gate: { width: '100%', marginTop: spacing.xl },
  camera: { flex: 1 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'space-between', padding: spacing.lg },
  tokenCard: {
    alignSelf: 'center', marginTop: spacing.xl,
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: radii.lg,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    borderWidth: 1.5, borderColor: colors.accent, alignItems: 'center',
  },
  tokenLabel: { color: colors.textSecondary, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  tokenText: { color: colors.accent, fontSize: 26, fontWeight: '900', letterSpacing: 1, marginVertical: 2 },
  tokenSub: { color: colors.textDim, fontSize: 11 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  flip: { width: 56, alignItems: 'center', justifyContent: 'center' },
  shutter: {
    width: 74, height: 74, borderRadius: radii.full,
    borderWidth: 4, borderColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  shutterRec: { borderColor: colors.red },
  shutterInner: { width: 58, height: 58, borderRadius: radii.full, backgroundColor: '#fff' },
  shutterInnerRec: { width: 30, height: 30, borderRadius: 8, backgroundColor: colors.red },
  timer: { color: '#fff', fontWeight: '800', fontSize: 14 },
  close: { position: 'absolute', top: spacing.lg, right: spacing.lg },
  preview: { flex: 1 },
  previewBar: { padding: spacing.lg, backgroundColor: colors.bgPage },
  previewHint: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: spacing.md },
}));
