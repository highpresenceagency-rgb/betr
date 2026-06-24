import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BackButton from '../../../components/BackButton';
import { GhostButton, PrimaryButton } from '../../../components/Button';
import Logo from '../../../components/Logo';
import ProgressBar from '../../../components/ProgressBar';
import { makeStyles } from '../../../lib/theme';

export default function SignUpStep2() {
  const styles = useStyles();
  const [photo, setPhoto] = useState<string | null>(null);

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
      router.push('/(auth)/sign-up/step-3');
    }
  };

  const pickFromLibrary = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
      router.push('/(auth)/sign-up/step-3');
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.container}>
        <BackButton />

        <Logo size="md" />
        <Text style={styles.stepLabel}>Create account · 2 of 4</Text>
        <ProgressBar step={2} />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Add a photo</Text>
          <Text style={styles.subtitle}>
            Friends are more likely to accept challenges from people they can see.
          </Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarRow}>
          <TouchableOpacity onPress={pickFromLibrary} activeOpacity={0.85}>
            <View style={styles.avatarRing}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarIcon}>👤</Text>
                </View>
              )}
            </View>
            <View style={styles.addBadge}>
              <Text style={styles.addIcon}>+</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.buttons}>
          <PrimaryButton label="Take a photo" onPress={pickFromCamera} />
          <View style={{ height: 8 }} />
          <GhostButton label="Choose from library" onPress={pickFromLibrary} />
        </View>

        <View style={styles.skipRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>or</Text>
          <View style={styles.orLine} />
        </View>

        <TouchableOpacity
          onPress={() => router.push('/(auth)/sign-up/step-3')}
          activeOpacity={0.7}
          style={styles.skipBtn}
        >
          <Text style={styles.skipText}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  safe: { flex: 1, backgroundColor: colors.bgPage },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  stepLabel: {
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 14,
  },
  titleBlock: {
    marginTop: 20,
    marginBottom: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
  },
  avatarRow: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.accentDark,
    borderTopWidth: 2,
    borderLeftWidth: 2,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderTopColor: colors.accentBorder,
    borderLeftColor: colors.accentBorderL,
    borderRightColor: colors.accentBorderR,
    borderBottomColor: colors.accentBorderB,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: { fontSize: 28 },
  addBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  addIcon: {
    color: colors.bg,
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 18,
  },
  buttons: {
    marginBottom: 16,
  },
  skipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderMid,
  },
  orText: {
    color: colors.textMuted,
    fontSize: 10,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  skipText: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '500',
  },
}));
